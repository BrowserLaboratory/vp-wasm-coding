/**
 * Type-contract tests for the Pyodide worker generate message protocol plus
 * the JSON factory-format detection logic.
 */
import { describe, it, expect } from 'vitest'
import type { GenerateRequest, GenerateComplete, GenerateTestcase } from '../worker/pyodide.worker'

// ── Type contract tests ──────────────────────────────────────────────────────

describe('GenerateRequest type', () => {
  it('accepts a valid generate request shape', () => {
    const req: GenerateRequest = {
      type: 'generate',
      generatorCode: 'print(input())',
      inputs: ['HELLO\n3', 'WORLD\n7'],
    }
    expect(req.type).toBe('generate')
    expect(req.generatorCode).toBe('print(input())')
    expect(req.inputs).toHaveLength(2)
  })
})

describe('GenerateTestcase type', () => {
  it('accepts a testcase without error', () => {
    const tc: GenerateTestcase = { input: 'HELLO\n3', expected_output: 'KHOOR' }
    expect(tc.input).toBe('HELLO\n3')
    expect(tc.expected_output).toBe('KHOOR')
    expect(tc.error).toBeUndefined()
  })

  it('accepts a testcase with error', () => {
    const tc: GenerateTestcase = { input: 'BAD', expected_output: '', error: 'SyntaxError' }
    expect(tc.error).toBe('SyntaxError')
  })
})

describe('GenerateComplete type', () => {
  it('accepts a valid generate_complete shape', () => {
    const msg: GenerateComplete = {
      type: 'generate_complete',
      testcases: [{ input: 'A\n1', expected_output: 'B' }],
    }
    expect(msg.type).toBe('generate_complete')
    expect(msg.testcases).toHaveLength(1)
  })
})

// ── JSON factory format logic ────────────────────────────────────────────────

/**
 * Mirrors the factory-format detection logic in handleGenerate.
 */
function applyFactoryFormat(
  input: string,
  rawOutput: string,
): { input: string; expected_output: string } {
  let tcInput = input
  let tcOutput = rawOutput
  if (rawOutput.startsWith('{')) {
    try {
      const parsed = JSON.parse(rawOutput) as { input: string; expected_output: string }
      if (typeof parsed.input === 'string' && typeof parsed.expected_output === 'string') {
        tcInput = parsed.input
        tcOutput = parsed.expected_output
      }
    } catch {
      // not JSON, use as-is
    }
  }
  return { input: tcInput, expected_output: tcOutput }
}

describe('JSON factory format detection', () => {
  it('passes through plain output unchanged', () => {
    const result = applyFactoryFormat('HELLO\n3', 'KHOOR')
    expect(result).toEqual({ input: 'HELLO\n3', expected_output: 'KHOOR' })
  })

  it('replaces input and output from JSON factory format', () => {
    const factoryJson = JSON.stringify({ input: 'KHOOR\n3', expected_output: 'HELLO' })
    const result = applyFactoryFormat('HELLO\n3', factoryJson)
    expect(result).toEqual({ input: 'KHOOR\n3', expected_output: 'HELLO' })
  })

  it('ignores JSON without required fields', () => {
    const rawOutput = JSON.stringify({ other: 'data' })
    const result = applyFactoryFormat('HELLO\n3', rawOutput)
    expect(result).toEqual({ input: 'HELLO\n3', expected_output: rawOutput })
  })

  it('treats malformed JSON as plain output', () => {
    const result = applyFactoryFormat('HELLO\n3', '{not valid json}')
    expect(result).toEqual({ input: 'HELLO\n3', expected_output: '{not valid json}' })
  })

  it('preserves newline in factory input field', () => {
    const factoryJson = JSON.stringify({ input: 'DBIQ\nKEY', expected_output: 'HELP' })
    const result = applyFactoryFormat('HELP\nKEY', factoryJson)
    expect(result.input).toBe('DBIQ\nKEY')
    expect(result.expected_output).toBe('HELP')
  })
})
