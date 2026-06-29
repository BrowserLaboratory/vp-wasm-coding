/**
 * Tests for the plain (non-Vue) executor controller.
 *
 * Adapted from the original Vue `useExecutor.spec.ts`: same behavioural
 * assertions (Worker mocked, ExecuteRequest shape, success/error resolution,
 * worker terminate after result, wall-clock kill) but against the plain
 * `createExecutor` API instead of Vue refs + a Pinia store.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createExecutor } from '../runtime/executor'
import type { ExecuteResult, TestcaseResult, RunComplete } from '../worker/messages'

// Class-based Worker mock so `new Worker(...)` works.
let lastWorkerInstance: MockWorker
class MockWorker {
  onmessage: ((e: MessageEvent) => void) | null = null
  onerror: ((e: Event) => void) | null = null
  postMessage = vi.fn()
  terminate = vi.fn()
  constructor() {
    lastWorkerInstance = this
  }
}
vi.stubGlobal('Worker', MockWorker)

describe('createExecutor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  it('exposes isRunning, run, stop, and execute', () => {
    const exec = createExecutor()
    expect(typeof exec.isRunning).toBe('function')
    expect(typeof exec.run).toBe('function')
    expect(typeof exec.stop).toBe('function')
    expect(typeof exec.execute).toBe('function')
  })

  it('isRunning starts as false', () => {
    const exec = createExecutor()
    expect(exec.isRunning()).toBe(false)
  })

  it('stop does not throw when not running', () => {
    const exec = createExecutor()
    expect(() => exec.stop()).not.toThrow()
  })

  describe('execute()', () => {
    it('creates a Worker and sends an ExecuteRequest', () => {
      const exec = createExecutor()
      exec.execute('print("hi")', 'hello')

      expect(lastWorkerInstance.postMessage).toHaveBeenCalledWith({
        type: 'execute',
        code: 'print("hi")',
        stdin: 'hello',
      })
    })

    it('resolves with ExecuteResult on success', async () => {
      const exec = createExecutor()
      const promise = exec.execute('print("hi")', 'hello')

      const result: ExecuteResult = { type: 'execute_result', stdout: 'hi\n', elapsed_ms: 10 }
      lastWorkerInstance.onmessage!(new MessageEvent('message', { data: result }))

      const res = await promise
      expect(res.stdout).toBe('hi\n')
      expect(res.elapsed_ms).toBe(10)
      expect(res.error).toBeUndefined()
    })

    it('resolves with error on runtime error', async () => {
      const exec = createExecutor()
      const promise = exec.execute('raise Exception("bad")', '')

      const result: ExecuteResult = {
        type: 'execute_result',
        stdout: '',
        elapsed_ms: 5,
        error: 'Exception: bad',
      }
      lastWorkerInstance.onmessage!(new MessageEvent('message', { data: result }))

      const res = await promise
      expect(res.error).toBe('Exception: bad')
    })

    it('terminates worker after receiving result', async () => {
      const exec = createExecutor()
      const promise = exec.execute('pass', '')

      const result: ExecuteResult = { type: 'execute_result', stdout: '', elapsed_ms: 1 }
      lastWorkerInstance.onmessage!(new MessageEvent('message', { data: result }))

      await promise
      expect(lastWorkerInstance.terminate).toHaveBeenCalled()
    })

    it('resolves with timeout error after wall-clock kill', async () => {
      const exec = createExecutor()
      const promise = exec.execute('while True: pass', '')

      vi.advanceTimersByTime(6_000)

      const res = await promise
      expect(res.error).toContain('timed out')
      expect(lastWorkerInstance.terminate).toHaveBeenCalled()
    })
  })

  describe('run()', () => {
    const tcs = [{ input: '', expected_output: 'A' }]

    it('sends a RunRequest and forwards verdictDetail', () => {
      const exec = createExecutor()
      void exec.run('print(1)', tcs, { verdictDetail: 'full' })

      expect(lastWorkerInstance.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'run', code: 'print(1)', verdictDetail: 'full' }),
      )
    })

    it('streams results and resolves done on run_complete', async () => {
      const exec = createExecutor()
      const onResult = vi.fn()
      const promise = exec.run('code', tcs, { onResult })
      const w = lastWorkerInstance

      expect(exec.isRunning()).toBe(true)

      const tcResult: TestcaseResult = {
        type: 'testcase_result',
        index: 0,
        verdict: 'AC',
        elapsed_ms: 1,
      }
      w.onmessage!(new MessageEvent('message', { data: tcResult }))
      expect(onResult).toHaveBeenCalledTimes(1)

      const complete: RunComplete = { type: 'run_complete', total: 1, passed: 1 }
      w.onmessage!(new MessageEvent('message', { data: complete }))

      const summary = await promise
      expect(summary.status).toBe('done')
      expect(summary.total).toBe(1)
      expect(summary.passed).toBe(1)
      expect(summary.results).toHaveLength(1)
      expect(w.terminate).toHaveBeenCalled()
      expect(exec.isRunning()).toBe(false)
    })

    it('wall-clock kill terminates the worker and resolves aborted', async () => {
      const exec = createExecutor()
      const promise = exec.run('while True: pass', tcs)
      const w = lastWorkerInstance

      expect(exec.isRunning()).toBe(true)
      vi.advanceTimersByTime(6_000)

      const summary = await promise
      expect(summary.status).toBe('aborted')
      expect(w.terminate).toHaveBeenCalled()
      expect(exec.isRunning()).toBe(false)
    })

    it('stop() during a run terminates the worker and settles aborted', async () => {
      const exec = createExecutor()
      const promise = exec.run('while True: pass', tcs)
      const w = lastWorkerInstance

      exec.stop()

      const summary = await promise
      expect(summary.status).toBe('aborted')
      expect(w.terminate).toHaveBeenCalled()
      expect(exec.isRunning()).toBe(false)
    })
  })
})
