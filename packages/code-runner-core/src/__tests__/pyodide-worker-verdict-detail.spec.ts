/**
 * Type-contract tests for the Worker verdict-detail data stripping.
 */
import { describe, it, expect } from 'vitest'
import type { RunRequest, TestcaseResult } from '../worker/pyodide.worker'

describe('RunRequest verdictDetail field', () => {
  it('accepts verdictDetail: hidden', () => {
    const req: RunRequest = {
      type: 'run',
      code: 'print(input())',
      testcases: [{ input: 'A', expected_output: 'A' }],
      verdictDetail: 'hidden',
    }
    expect(req.verdictDetail).toBe('hidden')
  })

  it('accepts verdictDetail: actual', () => {
    const req: RunRequest = {
      type: 'run',
      code: 'print(input())',
      testcases: [{ input: 'A', expected_output: 'A' }],
      verdictDetail: 'actual',
    }
    expect(req.verdictDetail).toBe('actual')
  })

  it('accepts verdictDetail: full', () => {
    const req: RunRequest = {
      type: 'run',
      code: 'print(input())',
      testcases: [{ input: 'A', expected_output: 'A' }],
      verdictDetail: 'full',
    }
    expect(req.verdictDetail).toBe('full')
  })

  it('defaults verdictDetail to undefined when omitted', () => {
    const req: RunRequest = {
      type: 'run',
      code: 'print(input())',
      testcases: [{ input: 'A', expected_output: 'A' }],
    }
    expect(req.verdictDetail).toBeUndefined()
  })
})

describe('TestcaseResult optional expected/actual fields', () => {
  it('accepts result without expected or actual (hidden mode)', () => {
    const result: TestcaseResult = {
      type: 'testcase_result',
      index: 0,
      verdict: 'WA',
      elapsed_ms: 10,
    }
    expect(result.verdict).toBe('WA')
    expect(result.expected).toBeUndefined()
    expect(result.actual).toBeUndefined()
  })

  it('accepts result with actual only (actual mode)', () => {
    const result: TestcaseResult = {
      type: 'testcase_result',
      index: 0,
      verdict: 'WA',
      actual: 'HELLO',
      elapsed_ms: 10,
    }
    expect(result.actual).toBe('HELLO')
    expect(result.expected).toBeUndefined()
  })

  it('accepts result with both expected and actual (full mode)', () => {
    const result: TestcaseResult = {
      type: 'testcase_result',
      index: 0,
      verdict: 'WA',
      actual: 'HELLO',
      expected: 'KHOOR',
      elapsed_ms: 10,
    }
    expect(result.actual).toBe('HELLO')
    expect(result.expected).toBe('KHOOR')
  })

  it('verdict field is always present regardless of mode', () => {
    const hidden: TestcaseResult = {
      type: 'testcase_result',
      index: 0,
      verdict: 'AC',
      elapsed_ms: 5,
    }
    const full: TestcaseResult = {
      type: 'testcase_result',
      index: 0,
      verdict: 'WA',
      expected: 'X',
      actual: 'Y',
      elapsed_ms: 5,
    }
    expect(hidden.verdict).toBe('AC')
    expect(full.verdict).toBe('WA')
  })
})
