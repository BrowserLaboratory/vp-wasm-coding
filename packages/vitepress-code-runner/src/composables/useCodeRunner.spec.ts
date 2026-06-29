import { describe, it, expect, vi } from 'vitest'

/**
 * Mock the pure-TS core so the composable's reactive state can be tested
 * without a real Pyodide worker. Each controller's `run`/`submit` streams two
 * results (one AC, one WA) through the provided callbacks then completes.
 */
vi.mock('@cxphoenix/vp-wasm-coding-core', () => {
  const fakeResults = [
    { type: 'testcase_result', index: 0, verdict: 'AC', elapsed_ms: 5 },
    { type: 'testcase_result', index: 1, verdict: 'WA', elapsed_ms: 7, actual: '5', expected: '6' },
  ]
  const summary = { results: fakeResults, total: 2, passed: 1, status: 'done' as const }
  const streamingRun = () =>
    vi.fn(async (_code: string, _tcs: unknown[], options?: { onResult?: (r: unknown) => void }) => {
      for (const r of fakeResults) options?.onResult?.(r)
      return summary
    })
  return {
    createExecutor: vi.fn(() => ({
      run: streamingRun(),
      execute: vi.fn(),
      stop: vi.fn(),
      isRunning: () => false,
    })),
    createDevRunner: vi.fn(() => ({
      runGenerator: vi.fn(async () => [{ input: '1', expected_output: '2' }]),
      submit: streamingRun(),
      stop: vi.fn(),
      cleanup: vi.fn(),
      isRunning: () => false,
    })),
    WALL_CLOCK_KILL_MS: 6000,
  }
})

import { useCodeRunner } from './useCodeRunner'

describe('useCodeRunner', () => {
  it('transitions idle → running → done and populates results (via run)', async () => {
    const runner = useCodeRunner()

    expect(runner.status.value).toBe('idle')
    expect(runner.isRunning.value).toBe(false)
    expect(runner.results.value).toEqual([])

    const tcs = [
      { input: '1', expected_output: '1' },
      { input: '2', expected_output: '3' },
    ]
    const promise = runner.run('print(1)', tcs)

    // Synchronous part of run() has executed: state is now running.
    expect(runner.status.value).toBe('running')
    expect(runner.isRunning.value).toBe(true)
    expect(runner.total.value).toBe(2)

    const result = await promise

    expect(runner.status.value).toBe('done')
    expect(runner.isRunning.value).toBe(false)
    expect(runner.results.value).toHaveLength(2)
    expect(runner.results.value.map((r) => r.verdict)).toEqual(['AC', 'WA'])
    expect(runner.passedCount.value).toBe(1)
    expect(result.passed).toBe(1)
  })

  it('submit drives the dev runner and counts AC verdicts', async () => {
    const runner = useCodeRunner()

    await runner.submit('print(1)', [{ input: '1', expected_output: '1' }])

    expect(runner.status.value).toBe('done')
    expect(runner.results.value.map((r) => r.verdict)).toEqual(['AC', 'WA'])
    expect(runner.passedCount.value).toBe(1)
  })

  it('runGenerator returns testcases from the dev runner', async () => {
    const runner = useCodeRunner()
    const tcs = await runner.runGenerator('gen', ['1'])
    expect(tcs).toEqual([{ input: '1', expected_output: '2' }])
    expect(runner.errorMessage.value).toBe('')
  })

  it('resets prior results when a new run starts', async () => {
    const runner = useCodeRunner()
    await runner.run('a', [{ input: '1', expected_output: '1' }])
    expect(runner.results.value).toHaveLength(2)

    const promise = runner.run('b', [{ input: '2', expected_output: '2' }])
    // begin() cleared results synchronously before streaming the new ones.
    expect(runner.total.value).toBe(1)
    await promise
    expect(runner.results.value).toHaveLength(2)
  })
})
