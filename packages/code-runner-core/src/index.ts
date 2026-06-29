/**
 * @cxphoenix/vp-wasm-coding-core — framework-agnostic Python execution engine.
 *
 * Pure TypeScript: no Vue, Pinia, or VitePress. Runs Python in an isolated
 * Pyodide worker, captures stdin/stdout, and produces AC/WA/RE/TLE verdicts.
 *
 * The only authoritative time limit is `worker.terminate()` (see executor /
 * runner). The in-worker op-counter and import blocklist are best-effort and
 * are NOT security or time-limit guarantees.
 */

// ── Pure worker utilities ────────────────────────────────────────────────────
export { buildWrappedCode, computeVerdict, buildTestcaseResultFields } from './worker/worker-utils'
export type { Verdict, VerdictDetail } from './worker/worker-utils'

// ── Main-thread controllers ──────────────────────────────────────────────────
export { createExecutor, WALL_CLOCK_KILL_MS } from './runtime/executor'
export type { Executor, ExecutorOptions, RunOptions, RunSummary } from './runtime/executor'

export { createDevRunner } from './runtime/runner'
export type { DevRunner, DevRunnerOptions, SubmitOptions, Testcase } from './runtime/runner'

// ── Message protocol types ───────────────────────────────────────────────────
export type {
  RunRequest,
  TestcaseResult,
  RunComplete,
  GenerateRequest,
  GenerateTestcase,
  GenerateComplete,
  RunOnlyRequest,
  RunOnlyTestcaseResult,
  RunOnlyComplete,
  ExecuteRequest,
  ExecuteResult,
  PreloadRequest,
  ConfigRequest,
  WorkerInMessage,
  WorkerOutMessage,
  PostMessage,
} from './worker/messages'
