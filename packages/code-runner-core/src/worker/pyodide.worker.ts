/**
 * Pyodide Web Worker — framework-agnostic core.
 *
 * Responsibilities:
 *  - Load Pyodide once, reuse across runs
 *  - Handle run / run_only / execute / generate / preload / config messages
 *  - Simulate stdin and capture stdout (via buildWrappedCode)
 *  - Best-effort op-count "TLE" hint via sys.settrace (NOT a guarantee)
 *  - Clear the namespace between testcases
 *
 * TIME LIMIT NOTE
 * ---------------
 * The op-count guard and the import blocklist injected by `buildWrappedCode`
 * are BEST-EFFORT only. The authoritative time limit is `worker.terminate()`
 * driven by the main-thread controller in `runtime/executor.ts`. Nothing here
 * should be treated as a security or time-limit guarantee.
 *
 * The message-handling logic is exported as plain functions that take an
 * injected Pyodide-like object and a `post` callback, so they can be unit
 * tested with a mocked Pyodide and without a real Worker context. The thin
 * `self.onmessage` wiring at the bottom is the only part that touches worker
 * globals, and it is guarded so this module is importable in Node/test envs.
 */

import { buildWrappedCode, computeVerdict, buildTestcaseResultFields } from './worker-utils'
import type {
  VerdictDetail,
  RunRequest,
  TestcaseResult,
  RunComplete,
  RunOnlyRequest,
  RunOnlyTestcaseResult,
  RunOnlyComplete,
  ExecuteRequest,
  ExecuteResult,
  GenerateRequest,
  GenerateTestcase,
  GenerateComplete,
  WorkerInMessage,
  WorkerOutMessage,
  PostMessage,
} from './messages'

// Re-export the message protocol so consumers (and the ported worker-protocol
// tests) can import the types straight from the worker module.
export type {
  VerdictDetail,
  RunRequest,
  TestcaseResult,
  RunComplete,
  RunOnlyRequest,
  RunOnlyTestcaseResult,
  RunOnlyComplete,
  ExecuteRequest,
  ExecuteResult,
  GenerateRequest,
  GenerateTestcase,
  GenerateComplete,
  WorkerInMessage,
  WorkerOutMessage,
} from './messages'

// ── Configuration ───────────────────────────────────────────────────────────

/** Default Pyodide index URL. Overridable via {@link setPyodideIndexURL}. */
export const DEFAULT_PYODIDE_INDEX_URL = '/pyodide/'
export const DEFAULT_OP_LIMIT = 10_000_000
/** Best-effort per-testcase wall-clock hint inside the worker (ms). */
export const WALL_CLOCK_MS = 5_000

let pyodideIndexURL = DEFAULT_PYODIDE_INDEX_URL

/**
 * Override the Pyodide index URL used by {@link ensurePyodide}.
 * This is the seam another task wires to a configurable asset base.
 */
export function setPyodideIndexURL(url: string): void {
  pyodideIndexURL = url
}

export function getPyodideIndexURL(): string {
  return pyodideIndexURL
}

// ── Pyodide loading ─────────────────────────────────────────────────────────

/** Minimal surface of the Pyodide instance the handlers depend on. */
export interface PyodideLike {
  runPythonAsync: (code: string) => Promise<unknown>
  globals: {
    clear?: () => void
    get: (name: string) => unknown
  }
}

let pyodide: PyodideLike | null = null

/** Load Pyodide on first call from the configured index URL, reuse thereafter. */
export async function ensurePyodide(): Promise<PyodideLike> {
  if (pyodide !== null) return pyodide

  // Dynamic import — @vite-ignore keeps the bundler from resolving the URL.
  const mod = await import(/* @vite-ignore */ `${pyodideIndexURL}pyodide.mjs`)
  pyodide = (await mod.loadPyodide({ indexURL: pyodideIndexURL })) as PyodideLike
  return pyodide
}

/** Clear the Pyodide namespace if the running version supports it. */
function clearGlobals(py: PyodideLike): void {
  try {
    py.globals.clear?.()
  } catch {
    // globals.clear() may not exist on all Pyodide versions; ignore
  }
}

// ── run handler (verdict comparison) ────────────────────────────────────────

export async function handleRun(
  py: PyodideLike,
  req: RunRequest,
  post: PostMessage,
): Promise<void> {
  const { code, testcases, opLimit = DEFAULT_OP_LIMIT, verdictDetail = 'hidden' } = req

  let passed = 0

  for (let i = 0; i < testcases.length; i++) {
    const tc = testcases[i]!
    const { input, expected_output } = tc
    const startTime = performance.now()

    // Best-effort in-worker wall-clock hint. The hard kill is worker.terminate()
    // on the main thread; this flag only catches re-entry after a yield.
    let wallClockTle = false
    const wallClock = setTimeout(() => {
      wallClockTle = true
    }, WALL_CLOCK_MS)

    clearGlobals(py)

    try {
      const wrapped = buildWrappedCode(code, input, opLimit)
      await py.runPythonAsync(wrapped)

      clearTimeout(wallClock)

      if (wallClockTle) {
        post({
          type: 'testcase_result',
          index: i,
          verdict: 'TLE',
          elapsed_ms: performance.now() - startTime,
          ...buildTestcaseResultFields('', expected_output, verdictDetail),
        } satisfies TestcaseResult)
        continue
      }

      const actual = (py.globals.get('_output') as string | undefined) ?? ''
      const elapsed_ms = performance.now() - startTime
      const verdict = computeVerdict(actual, expected_output)

      if (verdict === 'AC') passed++

      post({
        type: 'testcase_result',
        index: i,
        verdict,
        elapsed_ms,
        ...buildTestcaseResultFields(actual, expected_output, verdictDetail),
      } satisfies TestcaseResult)
    } catch (err: unknown) {
      clearTimeout(wallClock)
      const elapsed_ms = performance.now() - startTime
      const errMsg = String(err)
      const isTle = errMsg.includes('TimeoutError') || errMsg.includes('Operation limit')

      post({
        type: 'testcase_result',
        index: i,
        verdict: isTle ? 'TLE' : 'RE',
        elapsed_ms,
        error: isTle ? undefined : errMsg,
        ...buildTestcaseResultFields('', expected_output, verdictDetail),
      } satisfies TestcaseResult)
    }
  }

  post({
    type: 'run_complete',
    total: testcases.length,
    passed,
  } satisfies RunComplete)
}

// ── run_only handler (production mode, no comparison) ────────────────────────

export async function handleRunOnly(
  py: PyodideLike,
  req: RunOnlyRequest,
  post: PostMessage,
): Promise<void> {
  const { code, inputs, opLimit = DEFAULT_OP_LIMIT } = req

  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i]!
    const startTime = performance.now()

    clearGlobals(py)

    try {
      const wrapped = buildWrappedCode(code, input, opLimit)
      await py.runPythonAsync(wrapped)

      const stdout = (py.globals.get('_output') as string | undefined) ?? ''

      post({
        type: 'testcase_result',
        index: i,
        stdout,
        elapsed_ms: performance.now() - startTime,
      } satisfies RunOnlyTestcaseResult)
    } catch (err: unknown) {
      post({
        type: 'testcase_result',
        index: i,
        stdout: '',
        elapsed_ms: performance.now() - startTime,
        error: String(err),
      } satisfies RunOnlyTestcaseResult)
    }
  }

  post({ type: 'run_complete' } satisfies RunOnlyComplete)
}

// ── execute handler (pure execution, no verdict) ─────────────────────────────

export async function handleExecute(
  py: PyodideLike,
  req: ExecuteRequest,
  post: PostMessage,
): Promise<void> {
  const { code, stdin, opLimit = DEFAULT_OP_LIMIT } = req
  const startTime = performance.now()

  clearGlobals(py)

  try {
    const wrapped = buildWrappedCode(code, stdin, opLimit)
    await py.runPythonAsync(wrapped)

    const stdout = (py.globals.get('_output') as string | undefined) ?? ''

    post({
      type: 'execute_result',
      stdout,
      elapsed_ms: performance.now() - startTime,
    } satisfies ExecuteResult)
  } catch (err: unknown) {
    post({
      type: 'execute_result',
      stdout: '',
      elapsed_ms: performance.now() - startTime,
      error: String(err),
    } satisfies ExecuteResult)
  }
}

// ── generate handler ─────────────────────────────────────────────────────────

export async function handleGenerate(
  py: PyodideLike,
  req: GenerateRequest,
  post: PostMessage,
): Promise<void> {
  const { generatorCode, inputs } = req
  const testcases: GenerateTestcase[] = []

  for (const input of inputs) {
    clearGlobals(py)

    try {
      const wrapped = buildWrappedCode(generatorCode, input, DEFAULT_OP_LIMIT)
      await py.runPythonAsync(wrapped)
      const rawOutput = ((py.globals.get('_output') as string | undefined) ?? '').trimEnd()

      // Factory format: generator may emit JSON {"input": "...", "expected_output": "..."}
      // to transform the raw input into a different student-facing input format.
      let tcInput = input
      let tcOutput = rawOutput
      if (rawOutput.startsWith('{')) {
        try {
          const parsed = JSON.parse(rawOutput) as { input: string; expected_output: string }
          if (typeof parsed.input === 'string' && typeof parsed.expected_output === 'string') {
            tcInput = parsed.input
            tcOutput = parsed.expected_output
          }
        } catch {
          // Not valid JSON — treat as plain expected output
        }
      }

      testcases.push({ input: tcInput, expected_output: tcOutput })
    } catch (err: unknown) {
      testcases.push({ input, expected_output: '', error: String(err) })
    }
  }

  post({
    type: 'generate_complete',
    testcases,
  } satisfies GenerateComplete)
}

// ── Dispatch ─────────────────────────────────────────────────────────────────

/**
 * Route an inbound message to the matching handler. `preload` warms Pyodide and
 * `config` updates the index URL; all other messages ensure Pyodide is loaded
 * and then delegate to a handler.
 */
export async function dispatch(data: WorkerInMessage, post: PostMessage): Promise<void> {
  switch (data.type) {
    case 'config':
      setPyodideIndexURL(data.pyodideIndexURL)
      return
    case 'preload':
      await ensurePyodide()
      return
    case 'generate':
      return handleGenerate(await ensurePyodide(), data, post)
    case 'execute':
      return handleExecute(await ensurePyodide(), data, post)
    case 'run_only':
      return handleRunOnly(await ensurePyodide(), data, post)
    case 'run':
      return handleRun(await ensurePyodide(), data, post)
  }
}

// ── Worker wiring (guarded so this module is importable outside a worker) ─────

declare const self: { onmessage: ((event: MessageEvent<WorkerInMessage>) => void) | null; postMessage: (m: unknown) => void } | undefined

if (typeof self !== 'undefined' && typeof self.postMessage === 'function') {
  const post: PostMessage = (message) => self!.postMessage(message)
  self.onmessage = (event: MessageEvent<WorkerInMessage>) => {
    void dispatch(event.data, post)
  }
}
