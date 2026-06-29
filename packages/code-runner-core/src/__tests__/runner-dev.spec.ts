/**
 * Tests for the plain (non-Vue) dev runner.
 *
 * Adapted from the original Vue `useChallengeRunner-dev.spec.ts`: same
 * stop / cancel / cleanup behavioural assertions (worker terminate, kill-timer
 * cleared, no stale timer, in-flight Promise settles) but against the plain
 * `createDevRunner` API — no Pinia, no Vue refs, no WASM input generator.
 *
 * The WASM-driven `loadTestcases` of the source is split here: the generator
 * phase is exercised through `runGenerator`, and the submission phase through
 * `submit(code, testcases)`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createDevRunner } from '../runtime/runner'
import type { TestcaseResult, RunComplete, GenerateComplete } from '../worker/messages'

// ── Worker mock ───────────────────────────────────────────────────────────
const mockWorkerInstances: Array<{
  onmessage: ((e: MessageEvent) => void) | null
  onerror: ((e: Event) => void) | null
  postMessage: ReturnType<typeof vi.fn>
  terminate: ReturnType<typeof vi.fn>
}> = []
vi.stubGlobal(
  'Worker',
  class {
    onmessage: ((e: MessageEvent) => void) | null = null
    onerror: ((e: Event) => void) | null = null
    postMessage = vi.fn()
    terminate = vi.fn()
    constructor() {
      mockWorkerInstances.push(this as (typeof mockWorkerInstances)[number])
    }
  },
)

const TESTCASES = [
  { input: '1\n', expected_output: 'A' },
  { input: '2\n', expected_output: 'B' },
]

function lastWorker() {
  return mockWorkerInstances[mockWorkerInstances.length - 1]!
}

describe('createDevRunner — stop / cancel / cleanup semantics', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockWorkerInstances.length = 0
  })

  afterEach(() => {
    mockWorkerInstances.length = 0
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  // ── generator phase ────────────────────────────────────────────────────

  it('runGenerator drives the generate message and resolves testcases', async () => {
    const runner = createDevRunner()
    const promise = runner.runGenerator('gen', ['1\n', '2\n'])
    const w = lastWorker()

    expect(w.postMessage).toHaveBeenCalledWith({
      type: 'generate',
      generatorCode: 'gen',
      inputs: ['1\n', '2\n'],
    })

    const done: GenerateComplete = {
      type: 'generate_complete',
      testcases: [
        { input: '1\n', expected_output: 'A' },
        { input: '2\n', expected_output: 'B' },
      ],
    }
    w.onmessage!(new MessageEvent('message', { data: done }))

    const tcs = await promise
    expect(tcs).toEqual(TESTCASES)
    expect(w.terminate).toHaveBeenCalled()
  })

  it('stop() during generator phase terminates the active worker', () => {
    const runner = createDevRunner()
    // not awaited — generator worker created but never completes
    void runner.runGenerator('gen', ['1\n', '2\n'])
    const w = lastWorker()

    runner.stop()

    expect(w.terminate).toHaveBeenCalled()
    expect(runner.isRunning()).toBe(false)
  })

  // ── submission phase ───────────────────────────────────────────────────

  it('submit drives the run message and resolves per-testcase verdicts', async () => {
    const runner = createDevRunner()
    const results: TestcaseResult[] = []
    const promise = runner.submit('print(42)', TESTCASES, {
      verdictDetail: 'full',
      onResult: (r) => results.push(r),
    })
    const w = lastWorker()

    expect(w.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'run', code: 'print(42)', verdictDetail: 'full' }),
    )
    expect(runner.isRunning()).toBe(true)

    w.onmessage!(
      new MessageEvent('message', {
        data: { type: 'testcase_result', index: 0, verdict: 'AC', elapsed_ms: 1 } as TestcaseResult,
      }),
    )
    w.onmessage!(
      new MessageEvent('message', {
        data: { type: 'testcase_result', index: 1, verdict: 'WA', elapsed_ms: 1 } as TestcaseResult,
      }),
    )
    w.onmessage!(
      new MessageEvent('message', {
        data: { type: 'run_complete', total: 2, passed: 1 } as RunComplete,
      }),
    )

    const summary = await promise
    expect(summary.status).toBe('done')
    expect(summary.passed).toBe(1)
    expect(summary.results).toHaveLength(2)
    expect(results).toHaveLength(2)
    expect(runner.isRunning()).toBe(false)
  })

  it('stop() during submission terminates worker, clears killTimer, sets isRunning false', async () => {
    const runner = createDevRunner()
    const promise = runner.submit('print(42)', TESTCASES)
    const w = lastWorker()

    expect(runner.isRunning()).toBe(true)

    runner.stop()

    const result = await Promise.race([
      promise.then(() => 'settled'),
      vi.advanceTimersByTimeAsync(500).then(() => 'timeout'),
    ])
    expect(result).toBe('settled')
    expect(w.terminate).toHaveBeenCalled()
    expect(runner.isRunning()).toBe(false)
  })

  it('killTimer does not fire after stop()', async () => {
    const runner = createDevRunner()
    const promise = runner.submit('print(42)', TESTCASES)
    const w = lastWorker()

    runner.stop()
    const terminateCountAfterStop = w.terminate.mock.calls.length

    await vi.advanceTimersByTimeAsync(60_000)

    expect(w.terminate.mock.calls.length).toBe(terminateCountAfterStop)
    await promise
  })

  it('cleanup() during submission cancels killTimer and settles the Promise', async () => {
    const runner = createDevRunner()
    const promise = runner.submit('print(42)', TESTCASES)
    const w = lastWorker()

    runner.cleanup()

    const result = await Promise.race([
      promise.then(() => 'settled'),
      vi.advanceTimersByTimeAsync(500).then(() => 'timeout'),
    ])
    expect(result).toBe('settled')

    const terminateCountAfterCleanup = w.terminate.mock.calls.length
    await vi.advanceTimersByTimeAsync(60_000)
    expect(w.terminate.mock.calls.length).toBe(terminateCountAfterCleanup)
    await promise
  })

  it('no stale timer fires after cleanup()', async () => {
    const runner = createDevRunner()
    void runner.submit('print(42)', TESTCASES)
    const w = lastWorker()

    runner.cleanup()
    const terminateCount = w.terminate.mock.calls.length

    await vi.advanceTimersByTimeAsync(120_000)

    expect(w.terminate.mock.calls.length).toBe(terminateCount)
  })

  it('wall-clock kill terminates the submission worker and resolves aborted', async () => {
    const runner = createDevRunner()
    const promise = runner.submit('while True: pass', TESTCASES)
    const w = lastWorker()

    // budget = 2 testcases * 6000ms
    await vi.advanceTimersByTimeAsync(12_000)

    const summary = await promise
    expect(summary.status).toBe('aborted')
    expect(w.terminate).toHaveBeenCalled()
    expect(runner.isRunning()).toBe(false)
  })
})
