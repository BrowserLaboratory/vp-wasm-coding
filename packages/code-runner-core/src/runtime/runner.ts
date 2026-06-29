/**
 * Dev runner — framework-agnostic orchestration of the Pyodide generate → run
 * flow. Refactored out of the Vue `useChallengeRunner` (dev strategy only): no
 * Vue refs, no Pinia store, no WASM input generator, no prod/encrypted-pool
 * path. Those concerns live in the adapter package.
 *
 *   runGenerator(generatorCode, inputs) → drives the 'generate' message to
 *                                         produce testcases.
 *   submit(code, testcases)            → drives the 'run' message and returns
 *                                         per-testcase verdicts.
 *
 * Wall-clock hard kill on submit (preserved from the source): `worker.terminate()`
 * after `wallClockKillMs * testcases.length`, the authoritative time limit.
 */

import type {
  TestcaseResult,
  RunComplete,
  RunRequest,
  GenerateRequest,
  GenerateComplete,
  VerdictDetail,
} from '../worker/messages'
import type { RunSummary } from './executor'
import { WALL_CLOCK_KILL_MS } from './executor'

export type { RunSummary }

export interface Testcase {
  input: string
  expected_output: string
}

export interface DevRunnerOptions {
  /** Factory that creates a fresh Pyodide worker. Defaults to a module Worker. */
  createWorker?: () => Worker
  /** Wall-clock kill budget per testcase (ms). Default {@link WALL_CLOCK_KILL_MS}. */
  wallClockKillMs?: number
  /** Pyodide index URL forwarded to each worker via a `config` message. */
  pyodideIndexURL?: string
  /** Optional sink for per-input generator errors (defaults to console.error). */
  onGeneratorError?: (input: string, error: string) => void
}

export interface SubmitOptions {
  verdictDetail?: VerdictDetail
  opLimit?: number
  /** Called for each testcase as its verdict arrives. */
  onResult?: (result: TestcaseResult) => void
  /** Called once when the submission finishes (completed or aborted). */
  onComplete?: (summary: RunSummary) => void
}

export interface DevRunner {
  /** Run the generator over inputs to produce testcases. Resolves null on failure. */
  runGenerator(generatorCode: string, inputs: string[]): Promise<Testcase[] | null>
  /** Run student code against testcases, comparing trimmed output. */
  submit(code: string, testcases: Testcase[], options?: SubmitOptions): Promise<RunSummary>
  /** Terminate any active worker and settle an in-flight submission as aborted. */
  stop(): void
  /** stop() plus clear all retained references (call on teardown). */
  cleanup(): void
  /** Whether a submission is currently in flight. */
  isRunning(): boolean
}

function defaultCreateWorker(): Worker {
  return new Worker(new URL('../worker/pyodide.worker.ts', import.meta.url), {
    type: 'module',
  })
}

export function createDevRunner(options: DevRunnerOptions = {}): DevRunner {
  const createWorker = options.createWorker ?? defaultCreateWorker
  const killMs = options.wallClockKillMs ?? WALL_CLOCK_KILL_MS
  const { pyodideIndexURL } = options
  const onGeneratorError =
    options.onGeneratorError ??
    ((input: string, error: string) => console.error('[generator] error for input:', input, error))

  let running = false
  // Generator-phase worker
  let activeWorker: Worker | null = null
  // Submission worker + retained refs for stop/cancel
  let submitWorker: Worker | null = null
  let submitKillTimerId: ReturnType<typeof setTimeout> | null = null
  let submitAbort: (() => void) | null = null

  function configure(w: Worker) {
    if (pyodideIndexURL !== undefined) {
      w.postMessage({ type: 'config', pyodideIndexURL })
    }
  }

  function runGenerator(generatorCode: string, inputs: string[]): Promise<Testcase[] | null> {
    return new Promise((resolve) => {
      const worker = createWorker()
      activeWorker = worker
      configure(worker)

      worker.onmessage = (event: MessageEvent<GenerateComplete>) => {
        if (event.data.type === 'generate_complete') {
          activeWorker = null
          worker.terminate()
          const testcases = event.data.testcases.map((tc) => {
            if (tc.error) onGeneratorError(tc.input, tc.error)
            return { input: tc.input, expected_output: tc.expected_output }
          })
          resolve(testcases)
        }
      }

      worker.onerror = () => {
        activeWorker = null
        worker.terminate()
        resolve(null)
      }

      const req: GenerateRequest = { type: 'generate', generatorCode, inputs }
      worker.postMessage(req)
    })
  }

  function submit(
    code: string,
    testcases: Testcase[],
    submitOptions: SubmitOptions = {},
  ): Promise<RunSummary> {
    if (!testcases.length) {
      return Promise.resolve({ results: [], total: 0, passed: 0, status: 'done' })
    }

    running = true
    const results: TestcaseResult[] = []

    return new Promise<RunSummary>((resolve) => {
      const worker = createWorker()
      submitWorker = worker
      configure(worker)

      const finish = (status: RunSummary['status'], total: number, passed: number) => {
        if (submitKillTimerId !== null) {
          clearTimeout(submitKillTimerId)
          submitKillTimerId = null
        }
        submitWorker = null
        submitAbort = null
        running = false
        const summary: RunSummary = { results, total, passed, status }
        submitOptions.onComplete?.(summary)
        resolve(summary)
      }

      // Wall-clock hard kill (main-thread side) — the authoritative time limit.
      const totalBudget = testcases.length * killMs
      submitKillTimerId = setTimeout(() => {
        worker.terminate()
        finish('aborted', testcases.length, countPassed(results))
      }, totalBudget)

      submitAbort = () => {
        worker.terminate()
        finish('aborted', testcases.length, countPassed(results))
      }

      worker.onmessage = (event: MessageEvent<TestcaseResult | RunComplete>) => {
        const msg = event.data
        if (msg.type === 'testcase_result') {
          results.push(msg)
          submitOptions.onResult?.(msg)
        } else if (msg.type === 'run_complete') {
          worker.terminate()
          finish('done', msg.total, msg.passed)
        }
      }

      worker.onerror = () => {
        worker.terminate()
        finish('aborted', testcases.length, countPassed(results))
      }

      const request: RunRequest = {
        type: 'run',
        code,
        testcases: testcases.map((tc) => ({
          input: tc.input,
          expected_output: tc.expected_output,
        })),
        ...(submitOptions.verdictDetail !== undefined
          ? { verdictDetail: submitOptions.verdictDetail }
          : {}),
        ...(submitOptions.opLimit !== undefined ? { opLimit: submitOptions.opLimit } : {}),
      }
      worker.postMessage(request)
    })
  }

  function stop() {
    // Terminate generator-phase worker if active
    activeWorker?.terminate()
    activeWorker = null
    // Cancel submission kill timer and terminate/settle in-flight submission
    if (submitKillTimerId !== null) {
      clearTimeout(submitKillTimerId)
      submitKillTimerId = null
    }
    if (submitAbort) {
      const abort = submitAbort
      submitAbort = null
      abort()
    } else {
      submitWorker?.terminate()
      submitWorker = null
    }
    running = false
  }

  function cleanup() {
    stop()
    activeWorker = null
    submitWorker = null
    submitKillTimerId = null
    submitAbort = null
  }

  return {
    runGenerator,
    submit,
    stop,
    cleanup,
    isRunning: () => running,
  }
}

function countPassed(results: TestcaseResult[]): number {
  return results.filter((r) => r.verdict === 'AC').length
}
