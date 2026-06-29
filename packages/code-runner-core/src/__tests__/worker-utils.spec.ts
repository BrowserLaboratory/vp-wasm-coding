import { describe, it, expect } from 'vitest'
import { computeVerdict, buildWrappedCode, buildTestcaseResultFields } from '../worker/worker-utils'

describe('computeVerdict', () => {
  it('returns AC when output matches expected exactly', () => {
    expect(computeVerdict('HELLO', 'HELLO')).toBe('AC')
  })

  it('returns WA when output differs', () => {
    expect(computeVerdict('WORLD', 'HELLO')).toBe('WA')
  })

  it('strips trailing newline before comparing', () => {
    expect(computeVerdict('HELLO\n', 'HELLO')).toBe('AC')
  })

  it('strips trailing whitespace before comparing', () => {
    expect(computeVerdict('HELLO  \n', 'HELLO')).toBe('AC')
  })

  it('is case-sensitive', () => {
    expect(computeVerdict('hello', 'HELLO')).toBe('WA')
  })
})

describe('buildWrappedCode', () => {
  it('includes sys.settrace injection with the given op limit', () => {
    const code = buildWrappedCode('print("hi")', '42', 10_000_000)
    expect(code).toContain('sys.settrace')
    expect(code).toContain('10000000')
  })

  it('includes stdin simulation with the given input', () => {
    const code = buildWrappedCode('x = input()', 'hello world', 10_000_000)
    expect(code).toContain('io.StringIO')
    expect(code).toContain('hello world')
  })

  it('includes stdout capture via StringIO', () => {
    const code = buildWrappedCode('print("test")', '', 10_000_000)
    expect(code).toContain('_captured_stdout')
    expect(code).toContain('_output')
  })

  it('includes the user code verbatim', () => {
    const userCode = 'def solve(x):\n    return x * 2\nprint(solve(int(input())))'
    const code = buildWrappedCode(userCode, '5', 10_000_000)
    expect(code).toContain(userCode)
  })

  it('removes sys.settrace after user code runs', () => {
    const code = buildWrappedCode('pass', '', 10_000_000)
    expect(code).toContain('sys.settrace(None)')
  })

  it('includes sandbox guard before user code', () => {
    const code = buildWrappedCode('pass', '', 10_000_000)
    expect(code).toContain('_SandboxFinder')
    const sandboxPos = code.indexOf('_SandboxFinder')
    const userCodePos = code.indexOf('pass')
    expect(sandboxPos).toBeLessThan(userCodePos)
  })

  it('sandbox guard inserts finder at head of sys.meta_path', () => {
    const code = buildWrappedCode('pass', '', 10_000_000)
    expect(code).toContain('_sys.meta_path.insert(0, _SandboxFinder())')
  })

  it('sandbox guard clears pre-existing js module references from sys.modules', () => {
    const code = buildWrappedCode('pass', '', 10_000_000)
    expect(code).toContain('_sys.modules')
    expect(code).toContain("'js'")
    expect(code).toContain("'pyodide_js'")
    expect(code).toContain("'pyodide'")
  })

  it('sandbox guard find_module intercepts js, pyodide_js, pyodide and their submodules', () => {
    const code = buildWrappedCode('pass', '', 10_000_000)
    expect(code).toContain("'js.'")
    expect(code).toContain("'pyodide_js.'")
    expect(code).toContain("'pyodide.'")
  })

  it('sandbox guard raises ImportError for blocked modules', () => {
    const code = buildWrappedCode('pass', '', 10_000_000)
    expect(code).toContain('ImportError')
  })

  it('sandbox guard appears after op-counter and before stdin/stdout setup', () => {
    const code = buildWrappedCode('pass', 'input', 10_000_000)
    const opCounterPos = code.indexOf('sys.settrace(_tracer)')
    const sandboxPos = code.indexOf('_SandboxFinder')
    const stdinPos = code.indexOf('sys.stdin')
    expect(opCounterPos).toBeLessThan(sandboxPos)
    expect(sandboxPos).toBeLessThan(stdinPos)
  })
})

describe('buildTestcaseResultFields', () => {
  it('hidden mode returns neither expected nor actual', () => {
    const fields = buildTestcaseResultFields('HELLO', 'KHOOR', 'hidden')
    expect(fields).toEqual({})
    expect('expected' in fields).toBe(false)
    expect('actual' in fields).toBe(false)
  })

  it('actual mode returns actual but not expected', () => {
    const fields = buildTestcaseResultFields('HELLO', 'KHOOR', 'actual')
    expect(fields).toEqual({ actual: 'HELLO' })
    expect('expected' in fields).toBe(false)
  })

  it('full mode returns both expected and actual', () => {
    const fields = buildTestcaseResultFields('HELLO', 'KHOOR', 'full')
    expect(fields).toEqual({ actual: 'HELLO', expected: 'KHOOR' })
  })

  it('preserves exact string values without trimming', () => {
    const fields = buildTestcaseResultFields('HELLO\n', 'KHOOR\n', 'full')
    expect(fields.actual).toBe('HELLO\n')
    expect(fields.expected).toBe('KHOOR\n')
  })
})
