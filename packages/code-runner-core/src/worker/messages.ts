/**
 * Message protocol shared between the Pyodide worker and the main-thread
 * controllers (executor / runner).
 *
 * Kept in a dedicated, side-effect-free module so the runtime controllers and
 * the public `index.ts` can import these types without ever evaluating the
 * worker module body (which touches the `self` worker global).
 */

import type { VerdictDetail } from './worker-utils'
export type { VerdictDetail }

// ── Inbound: run + verdict comparison ──────────────────────────────────────

export interface RunRequest {
  type: 'run'
  code: string
  testcases: Array<{ input: string; expected_output: string }>
  /** Maximum Python bytecode operations per testcase (best-effort). Default: 10_000_000 */
  opLimit?: number
  /** Controls which fields are included in TestcaseResult. Default: 'hidden' */
  verdictDetail?: VerdictDetail
}

export interface TestcaseResult {
  type: 'testcase_result'
  index: number
  verdict: 'AC' | 'WA' | 'TLE' | 'RE'
  actual?: string
  expected?: string
  elapsed_ms: number
  /** Set for RE verdicts */
  error?: string
}

export interface RunComplete {
  type: 'run_complete'
  total: number
  passed: number
}

// ── Inbound: generator ──────────────────────────────────────────────────────

/** Request to run the generator script against a list of inputs. */
export interface GenerateRequest {
  type: 'generate'
  generatorCode: string
  inputs: string[]
}

export interface GenerateTestcase {
  input: string
  expected_output: string
  /** Set if the generator threw an error for this input */
  error?: string
}

export interface GenerateComplete {
  type: 'generate_complete'
  testcases: GenerateTestcase[]
}

// ── Inbound: run-only (no comparison) ───────────────────────────────────────

/** Request to run code against multiple inputs without verdict comparison. */
export interface RunOnlyRequest {
  type: 'run_only'
  code: string
  inputs: string[]
  /** Maximum Python bytecode operations per testcase (best-effort). Default: 10_000_000 */
  opLimit?: number
}

/** Per-input result emitted by the run_only handler (raw stdout, no verdict). */
export interface RunOnlyTestcaseResult {
  type: 'testcase_result'
  index: number
  stdout: string
  error?: string
  elapsed_ms: number
}

/** Completion marker for the run_only handler. */
export interface RunOnlyComplete {
  type: 'run_complete'
}

// ── Inbound: execute (pure execution) ───────────────────────────────────────

/** Request to execute code with stdin, returning raw stdout (no verdict). */
export interface ExecuteRequest {
  type: 'execute'
  code: string
  stdin: string
  /** Maximum Python bytecode operations (best-effort). Default: 10_000_000 */
  opLimit?: number
}

export interface ExecuteResult {
  type: 'execute_result'
  stdout: string
  elapsed_ms: number
  /** Set if execution failed (runtime error or op-counter TLE) */
  error?: string
}

// ── Inbound: lifecycle ──────────────────────────────────────────────────────

/** Warm up Pyodide ahead of time. */
export interface PreloadRequest {
  type: 'preload'
}

/**
 * Configure the worker before any Python runs — currently the Pyodide index
 * URL. This is the seam another task uses to wire a configurable asset base.
 */
export interface ConfigRequest {
  type: 'config'
  pyodideIndexURL: string
}

// ── Unions ──────────────────────────────────────────────────────────────────

export type WorkerInMessage =
  | RunRequest
  | RunOnlyRequest
  | ExecuteRequest
  | GenerateRequest
  | PreloadRequest
  | ConfigRequest

export type WorkerOutMessage =
  | TestcaseResult
  | RunComplete
  | RunOnlyTestcaseResult
  | RunOnlyComplete
  | GenerateComplete
  | ExecuteResult

/** Function used by a handler to emit a message back to the main thread. */
export type PostMessage = (message: WorkerOutMessage) => void
