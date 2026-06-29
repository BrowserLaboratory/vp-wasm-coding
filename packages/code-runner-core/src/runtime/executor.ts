/**
 * Executor — framework-agnostic controller for the Pyodide worker lifecycle.
 *
 * Refactored out of the original Vue `useExecutor` composable: no Vue refs, no
 * Pinia store. State is plain, results are delivered through callbacks and the
 * returned Promises.
 *
 * Wall-clock hard kill (preserved from the source): if the worker does not
 * finish within `wallClockKillMs * testcases.length`, the main thread calls
 * `worker.terminate()`. This terminate is the ONLY authoritative time limit —
 * the in-worker op-counter is best-effort and must not be relied upon.
 */

import type {
  RunRequest,
  TestcaseResult,
  RunComplete,
  ExecuteRequest,
  ExecuteResult,
  ConfigRequest,
  VerdictDetail,
} from '../worker/messages'

/** Default wall-clock kill budget per testcase, in milliseconds. */
export const WALL_CLOCK_KILL_MS = 6_000

export interface ExecutorOptions {
  /**
   * Factory that creates a fresh Pyodide worker. Defaults to a module Worker
   * pointing at the bundled `pyodide.worker.ts`. Override for testing or to
   * customise worker construction.
   */
  createWorker?: () => Worker
  /** Wall-clock kill budget per testcase (ms). Default {@link WALL_CLOCK_KILL_MS}. */
  wallClockKillMs?: number
  /**
   * Pyodide index URL forwarded to each worker via a `config` message before
   * the run/execute request. When omitted the worker uses its own default.
   */
  pyodideIndexURL?: string
}

export interface RunOptions {
  verdictDetail?: VerdictDetail
  opLimit?: number
  /** Called for each testcase as its result arrives. */
  onResult?: (result: TestcaseResult) => void
  /** Called once when the run finishes (completed or aborted). */
  onComplete?: (summary: RunSummary) => void
  /** Called if the worker emits an error event. */
  onError?: (error: unknown) => void
}

export interface RunSummary {
  results: TestcaseResult[]
  total: number
  passed: number
  /** 'done' on natural completion, 'aborted' on stop() or wall-clock kill. */
  status: 'done' | 'aborted'
}

export interface Executor {
  /** Run code against testcases, comparing trimmed output. Resolves on completion. */
  run(
    code: string,
    testcases: Array<{ input: string; expected_output: string }>,
    options?: RunOptions,
  ): Promise<RunSummary>
  /** Execute code with stdin, returning raw stdout (no verdict comparison). */
  execute(code: string, stdin: string, opLimit?: number): Promise<ExecuteResult>
  /** Terminate the active worker and settle any in-flight run as aborted. */
  stop(): void
  /** Whether a run is currently in flight. */
  isRunning(): boolean
}

function defaultCreateWorker(): Worker {
  return new Worker(new URL('../worker/pyodide.worker.ts', import.meta.url), {
    type: 'module',
  })
}

export function createExecutor(options: ExecutorOptions = {}): Executor {
  const createWorker = options.createWorker ?? defaultCreateWorker
  const killMs = options.wallClockKillMs ?? WALL_CLOCK_KILL_MS
  const { pyodideIndexURL } = options

  let worker: Worker | null = null
  let killTimer: ReturnType<typeof setTimeout> | null = null
  let running = false
  /** Settle the in-flight run() promise as aborted (used by stop()). */
  let abortInflight: (() => void) | null = null

  function clearKillTimer() {
    if (killTimer !== null) {
      clearTimeout(killTimer)
      killTimer = null
    }
  }

  function terminateWorker() {
    worker?.terminate()
    worker = null
  }

  function configure(w: Worker) {
    if (pyodideIndexURL !== undefined) {
      w.postMessage({ type: 'config', pyodideIndexURL } satisfies ConfigRequest)
    }
  }

  function stop() {
    clearKillTimer()
    terminateWorker()
    running = false
    if (abortInflight) {
      const settle = abortInflight
      abortInflight = null
      settle()
    }
  }

  function run(
    code: string,
    testcases: Array<{ input: string; expected_output: string }>,
    runOptions: RunOptions = {},
  ): Promise<RunSummary> {
    if (running) stop()
    running = true

    const results: TestcaseResult[] = []

    return new Promise<RunSummary>((resolve) => {
      const w = createWorker()
      worker = w
      configure(w)

      const finish = (status: RunSummary['status'], total: number, passed: number) => {
        clearKillTimer()
        running = false
        abortInflight = null
        const summary: RunSummary = { results, total, passed, status }
        runOptions.onComplete?.(summary)
        resolve(summary)
      }

      // Wall-clock hard kill (main-thread side) — the authoritative time limit.
      const totalBudget = Math.max(testcases.length, 1) * killMs
      killTimer = setTimeout(() => {
        terminateWorker()
        finish('aborted', testcases.length, countPassed(results))
      }, totalBudget)

      abortInflight = () => {
        finish('aborted', testcases.length, countPassed(results))
      }

      w.onmessage = (event: MessageEvent<TestcaseResult | RunComplete>) => {
        const msg = event.data
        if (msg.type === 'testcase_result') {
          results.push(msg)
          runOptions.onResult?.(msg)
        } else if (msg.type === 'run_complete') {
          terminateWorker()
          finish('done', msg.total, msg.passed)
        }
      }

      w.onerror = (event: Event) => {
        runOptions.onError?.(event)
        terminateWorker()
        finish('aborted', testcases.length, countPassed(results))
      }

      const request: RunRequest = {
        type: 'run',
        code,
        testcases: testcases.map((tc) => ({
          input: tc.input,
          expected_output: tc.expected_output,
        })),
        ...(runOptions.verdictDetail !== undefined ? { verdictDetail: runOptions.verdictDetail } : {}),
        ...(runOptions.opLimit !== undefined ? { opLimit: runOptions.opLimit } : {}),
      }
      w.postMessage(request)
    })
  }

  function execute(code: string, stdin: string, opLimit?: number): Promise<ExecuteResult> {
    return new Promise<ExecuteResult>((resolve) => {
      const w = createWorker()
      configure(w)

      const timer = setTimeout(() => {
        w.terminate()
        resolve({
          type: 'execute_result',
          stdout: '',
          elapsed_ms: killMs,
          error: 'Execution timed out',
        })
      }, killMs)

      w.onmessage = (event: MessageEvent<ExecuteResult>) => {
        if (event.data.type === 'execute_result') {
          clearTimeout(timer)
          w.terminate()
          resolve(event.data)
        }
      }

      w.onerror = () => {
        clearTimeout(timer)
        w.terminate()
        resolve({
          type: 'execute_result',
          stdout: '',
          elapsed_ms: 0,
          error: 'Worker error',
        })
      }

      const request: ExecuteRequest = {
        type: 'execute',
        code,
        stdin,
        ...(opLimit !== undefined ? { opLimit } : {}),
      }
      w.postMessage(request)
    })
  }

  return {
    run,
    execute,
    stop,
    isRunning: () => running,
  }
}

function countPassed(results: TestcaseResult[]): number {
  return results.filter((r) => r.verdict === 'AC').length
}
