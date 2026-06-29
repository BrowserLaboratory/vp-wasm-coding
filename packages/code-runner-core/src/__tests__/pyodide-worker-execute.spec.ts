/**
 * Type-contract tests for the Pyodide worker execute message protocol.
 */
import { describe, it, expect } from 'vitest'
import type { ExecuteRequest, ExecuteResult } from '../worker/pyodide.worker'

describe('ExecuteRequest type', () => {
  it('accepts a valid execute request shape', () => {
    const req: ExecuteRequest = {
      type: 'execute',
      code: 'print("hello")',
      stdin: 'world',
    }
    expect(req.type).toBe('execute')
    expect(req.code).toBe('print("hello")')
    expect(req.stdin).toBe('world')
    expect(req.opLimit).toBeUndefined()
  })

  it('accepts optional opLimit', () => {
    const req: ExecuteRequest = {
      type: 'execute',
      code: 'x = input()',
      stdin: '42',
      opLimit: 5_000_000,
    }
    expect(req.opLimit).toBe(5_000_000)
  })
})

describe('ExecuteResult type', () => {
  it('accepts a successful execution result', () => {
    const result: ExecuteResult = {
      type: 'execute_result',
      stdout: 'hello world\n',
      elapsed_ms: 12.5,
    }
    expect(result.type).toBe('execute_result')
    expect(result.stdout).toBe('hello world\n')
    expect(result.elapsed_ms).toBe(12.5)
    expect(result.error).toBeUndefined()
  })

  it('accepts an error result', () => {
    const result: ExecuteResult = {
      type: 'execute_result',
      stdout: '',
      elapsed_ms: 3.2,
      error: 'NameError: name "foo" is not defined',
    }
    expect(result.error).toBe('NameError: name "foo" is not defined')
  })

  it('accepts a TLE error result', () => {
    const result: ExecuteResult = {
      type: 'execute_result',
      stdout: '',
      elapsed_ms: 5000,
      error: 'TimeoutError: Operation limit exceeded (10000000 ops)',
    }
    expect(result.error).toContain('TimeoutError')
  })
})
