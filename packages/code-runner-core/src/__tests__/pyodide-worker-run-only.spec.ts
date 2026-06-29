/**
 * Type-contract tests for the Pyodide worker run_only message protocol.
 */
import { describe, it, expect } from 'vitest'
import type { RunOnlyRequest } from '../worker/pyodide.worker'

interface RunOnlyTestcaseResult {
  type: 'testcase_result'
  index: number
  stdout: string
  error?: string
  elapsed_ms: number
}

describe('RunOnlyRequest type', () => {
  it('accepts a valid run_only request shape', () => {
    const req: RunOnlyRequest = {
      type: 'run_only',
      code: 'print("hello")',
      inputs: ['world'],
    }
    expect(req.type).toBe('run_only')
    expect(req.code).toBe('print("hello")')
    expect(req.inputs).toEqual(['world'])
    expect(req.opLimit).toBeUndefined()
  })

  it('accepts multiple inputs', () => {
    const req: RunOnlyRequest = {
      type: 'run_only',
      code: 'for line in sys.stdin: print(line)',
      inputs: ['a', 'b', 'c'],
    }
    expect(req.inputs).toHaveLength(3)
    expect(req.inputs[0]).toBe('a')
  })

  it('accepts optional opLimit', () => {
    const req: RunOnlyRequest = {
      type: 'run_only',
      code: 'x = input()',
      inputs: ['42'],
      opLimit: 5_000_000,
    }
    expect(req.opLimit).toBe(5_000_000)
  })
})

describe('RunOnlyResult type', () => {
  it('accepts a successful testcase_result with required fields only', () => {
    const result: RunOnlyTestcaseResult = {
      type: 'testcase_result',
      index: 0,
      stdout: 'hello world\n',
      elapsed_ms: 12.5,
    }
    expect(result.type).toBe('testcase_result')
    expect(result.index).toBe(0)
    expect(result.stdout).toBe('hello world\n')
    expect(result.elapsed_ms).toBe(12.5)
    expect(result.error).toBeUndefined()
  })

  it('accepts a testcase_result with an error field', () => {
    const result: RunOnlyTestcaseResult = {
      type: 'testcase_result',
      index: 1,
      stdout: '',
      elapsed_ms: 3.2,
      error: 'NameError: name "foo" is not defined',
    }
    expect(result.error).toBe('NameError: name "foo" is not defined')
  })

  it('does NOT contain verdict, expected, or actual fields', () => {
    const result: RunOnlyTestcaseResult = {
      type: 'testcase_result',
      index: 0,
      stdout: '42\n',
      elapsed_ms: 8.0,
    }
    expect(result).not.toHaveProperty('verdict')
    expect(result).not.toHaveProperty('expected')
    expect(result).not.toHaveProperty('actual')
  })

  it('accepts a TLE error result', () => {
    const result: RunOnlyTestcaseResult = {
      type: 'testcase_result',
      index: 2,
      stdout: '',
      elapsed_ms: 5000,
      error: 'TimeoutError: Operation limit exceeded (5000000 ops)',
    }
    expect(result.error).toContain('TimeoutError')
    expect(result).not.toHaveProperty('verdict')
  })
})
