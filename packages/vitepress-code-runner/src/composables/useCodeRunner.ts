/**
 * useCodeRunner — the Vue reactivity layer over the framework-agnostic core
 * (task 6.1). Vue refs live HERE; `@cxphoenix/vp-wasm-coding-core` stays pure TS.
 *
 * It wraps both core controllers:
 *   - `createExecutor` → `run(code, testcases)` (verdict-compared run)
 *   - `createDevRunner` → `runGenerator(...)` + `submit(code, testcases)`
 *
 * and surfaces a small reactive state machine (`status: idle → running → done`,
 * plus `results` / `passedCount` / `total` / `errorMessage`). Per-testcase
 * results stream in through the core `onResult` callbacks.
 *
 * SSR safety (task 6.1 / 5.4): controllers are created lazily on the first
 * `run`/`submit`/`runGenerator` — i.e. after a user interaction, which only
 * happens post-mount in the browser. Nothing here touches a Worker, wasm, or
 * any browser global at module or `setup()` scope.
 */
import { ref, computed, shallowRef, type Ref, type ComputedRef } from 'vue'
import {
  createExecutor,
  createDevRunner,
  type Executor,
  type DevRunner,
  type TestcaseResult,
  type RunSummary,
  type Testcase,
  type VerdictDetail,
} from '@cxphoenix/vp-wasm-coding-core'
import { resolvePyodideIndexURL, type AssetBaseConfig } from '../config'

export type RunnerStatus = 'idle' | 'running' | 'done'

export interface UseCodeRunnerOptions {
  /** Explicit Pyodide index URL. Overrides the value derived from {@link assetBase}. */
  pyodideIndexURL?: string
  /** Asset-base config used to derive the Pyodide index URL (task 6.2). */
  assetBase?: AssetBaseConfig
  /** Wall-clock kill budget per testcase (ms). Forwarded to the core controller. */
  wallClockKillMs?: number
  /** Controls how much per-testcase detail the worker returns. Default `'hidden'`. */
  verdictDetail?: VerdictDetail
  /** Best-effort op limit forwarded to the worker. */
  opLimit?: number
}

export interface UseCodeRunnerReturn {
  /** Reactive state machine: `idle` → `running` → `done`. */
  status: Ref<RunnerStatus>
  /** Per-testcase results, populated as they stream in. */
  results: Ref<TestcaseResult[]>
  /** Number of testcases the current run is executing against. */
  total: Ref<number>
  /** Human-readable error message for generator/setup failures (never throws). */
  errorMessage: Ref<string>
  /** `true` while a run/submission is in flight. */
  isRunning: ComputedRef<boolean>
  /** Count of AC verdicts in {@link results}. */
  passedCount: ComputedRef<number>
  /** Run code against testcases via the core executor. Resolves with the summary. */
  run(code: string, testcases: Testcase[]): Promise<RunSummary>
  /** Submit code against testcases via the core dev runner. Resolves with the summary. */
  submit(code: string, testcases: Testcase[]): Promise<RunSummary>
  /** Drive the generator to turn raw inputs into testcases. Resolves `null` on failure. */
  runGenerator(generatorCode: string, inputs: string[]): Promise<Testcase[] | null>
  /** Stop any in-flight run and mark the state `done`. */
  stop(): void
  /** Tear down controllers and release references (call on unmount). */
  cleanup(): void
}

export function useCodeRunner(options: UseCodeRunnerOptions = {}): UseCodeRunnerReturn {
  const status = ref<RunnerStatus>('idle')
  const results = ref<TestcaseResult[]>([])
  const total = ref(0)
  const errorMessage = ref('')

  const isRunning = computed(() => status.value === 'running')
  const passedCount = computed(() => results.value.filter((r) => r.verdict === 'AC').length)

  // Controllers held in shallowRefs and created lazily (SSR-safe).
  const executorRef = shallowRef<Executor | null>(null)
  const devRunnerRef = shallowRef<DevRunner | null>(null)

  function pyodideIndexURL(): string {
    return options.pyodideIndexURL ?? resolvePyodideIndexURL(options.assetBase)
  }

  function ensureExecutor(): Executor {
    if (!executorRef.value) {
      executorRef.value = createExecutor({
        pyodideIndexURL: pyodideIndexURL(),
        ...(options.wallClockKillMs !== undefined
          ? { wallClockKillMs: options.wallClockKillMs }
          : {}),
      })
    }
    return executorRef.value
  }

  function ensureDevRunner(): DevRunner {
    if (!devRunnerRef.value) {
      devRunnerRef.value = createDevRunner({
        pyodideIndexURL: pyodideIndexURL(),
        ...(options.wallClockKillMs !== undefined
          ? { wallClockKillMs: options.wallClockKillMs }
          : {}),
      })
    }
    return devRunnerRef.value
  }

  function begin(count: number): void {
    status.value = 'running'
    results.value = []
    total.value = count
    errorMessage.value = ''
  }

  function streamOptions() {
    return {
      ...(options.verdictDetail !== undefined ? { verdictDetail: options.verdictDetail } : {}),
      ...(options.opLimit !== undefined ? { opLimit: options.opLimit } : {}),
      onResult: (r: TestcaseResult) => {
        results.value.push(r)
      },
    }
  }

  async function run(code: string, testcases: Testcase[]): Promise<RunSummary> {
    begin(testcases.length)
    const summary = await ensureExecutor().run(code, testcases, streamOptions())
    status.value = 'done'
    return summary
  }

  async function submit(code: string, testcases: Testcase[]): Promise<RunSummary> {
    begin(testcases.length)
    const summary = await ensureDevRunner().submit(code, testcases, streamOptions())
    status.value = 'done'
    return summary
  }

  async function runGenerator(
    generatorCode: string,
    inputs: string[],
  ): Promise<Testcase[] | null> {
    const testcases = await ensureDevRunner().runGenerator(generatorCode, inputs)
    if (testcases === null) {
      errorMessage.value = 'Generator 執行失敗，請確認 generator 程式碼正確'
    }
    return testcases
  }

  function stop(): void {
    executorRef.value?.stop()
    devRunnerRef.value?.stop()
    if (status.value === 'running') status.value = 'done'
  }

  function cleanup(): void {
    executorRef.value?.stop()
    devRunnerRef.value?.cleanup()
    executorRef.value = null
    devRunnerRef.value = null
  }

  return {
    status,
    results,
    total,
    errorMessage,
    isRunning,
    passedCount,
    run,
    submit,
    runGenerator,
    stop,
    cleanup,
  }
}
