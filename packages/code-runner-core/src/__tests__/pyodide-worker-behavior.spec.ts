/**
 * Behavioural tests for the Pyodide worker message handlers.
 *
 * The handlers are exported as plain functions taking an injected Pyodide-like
 * object and a `post` callback, so we can exercise the real run/run_only/
 * execute/generate logic with a mocked Pyodide — no Worker context required.
 *
 * Pyodide is faked: each `runPythonAsync` call consumes the next scripted step,
 * setting `_output` (success) or throwing (runtime / TLE error). This verifies
 * stdin/stdout capture wiring and AC/WA/RE/TLE verdict classification.
 */
import { describe, it, expect } from 'vitest'
import {
  handleRun,
  handleRunOnly,
  handleExecute,
  handleGenerate,
  type PyodideLike,
} from '../worker/pyodide.worker'
import type { WorkerOutMessage } from '../worker/messages'

/** A scripted fake Pyodide. Each runPythonAsync consumes one step. */
function scriptedPyodide(steps: Array<string | Error>): {
  py: PyodideLike
  lastCode: () => string
} {
  const store = new Map<string, unknown>()
  let i = 0
  let lastCode = ''
  const py: PyodideLike = {
    runPythonAsync: async (code: string) => {
      lastCode = code
      const step = steps[i++]
      if (step instanceof Error) throw step
      store.set('_output', step ?? '')
    },
    globals: {
      clear: () => store.clear(),
      get: (name: string) => store.get(name),
    },
  }
  return { py, lastCode: () => lastCode }
}

function collector() {
  const messages: WorkerOutMessage[] = []
  const post = (m: WorkerOutMessage) => {
    messages.push(m)
  }
  return { messages, post }
}

describe('handleExecute', () => {
  it('captures stdout from _output and wires stdin into the wrapped code', async () => {
    const { py, lastCode } = scriptedPyodide(['hi\n'])
    const { messages, post } = collector()

    await handleExecute(py, { type: 'execute', code: 'print("hi")', stdin: 'fed-stdin' }, post)

    expect(messages).toHaveLength(1)
    const msg = messages[0]!
    expect(msg.type).toBe('execute_result')
    if (msg.type === 'execute_result') {
      expect(msg.stdout).toBe('hi\n')
      expect(msg.error).toBeUndefined()
    }
    // stdin and user code are embedded in the wrapped program (stdin capture)
    expect(lastCode()).toContain('fed-stdin')
    expect(lastCode()).toContain('print("hi")')
  })

  it('reports a runtime error', async () => {
    const { py } = scriptedPyodide([new Error('Exception: bad')])
    const { messages, post } = collector()

    await handleExecute(py, { type: 'execute', code: 'raise Exception("bad")', stdin: '' }, post)

    const msg = messages[0]!
    expect(msg.type).toBe('execute_result')
    if (msg.type === 'execute_result') {
      expect(msg.stdout).toBe('')
      expect(msg.error).toContain('Exception: bad')
    }
  })
})

describe('handleRun verdict classification', () => {
  it('classifies AC / WA / RE / TLE across testcases', async () => {
    const { py } = scriptedPyodide([
      'HELLO\n', // matches expected -> AC (trailing newline trimmed)
      'WORLD', // mismatch -> WA
      new Error('NameError: x is not defined'), // -> RE
      new Error('TimeoutError: Operation limit exceeded (10000000 ops)'), // -> TLE
    ])
    const { messages, post } = collector()

    await handleRun(
      py,
      {
        type: 'run',
        code: 'print(input())',
        testcases: [
          { input: '', expected_output: 'HELLO' },
          { input: '', expected_output: 'HELLO' },
          { input: '', expected_output: 'HELLO' },
          { input: '', expected_output: 'HELLO' },
        ],
        verdictDetail: 'full',
      },
      post,
    )

    const results = messages.filter((m) => m.type === 'testcase_result')
    expect(results.map((r) => ('verdict' in r ? r.verdict : ''))).toEqual(['AC', 'WA', 'RE', 'TLE'])

    // RE carries the error message; TLE does not
    const re = results[2]
    const tle = results[3]
    if (re && 'verdict' in re) expect(re.error).toContain('NameError')
    if (tle && 'verdict' in tle) expect(tle.error).toBeUndefined()

    const complete = messages.find((m) => m.type === 'run_complete')
    expect(complete).toBeDefined()
    if (complete && 'total' in complete) {
      expect(complete.total).toBe(4)
      expect(complete.passed).toBe(1)
    }
  })

  it('strips actual/expected in hidden mode', async () => {
    const { py } = scriptedPyodide(['NOPE'])
    const { messages, post } = collector()

    await handleRun(
      py,
      {
        type: 'run',
        code: 'pass',
        testcases: [{ input: '', expected_output: 'YEP' }],
        verdictDetail: 'hidden',
      },
      post,
    )

    const r = messages[0]!
    if ('verdict' in r) {
      expect(r.verdict).toBe('WA')
      expect(r.actual).toBeUndefined()
      expect(r.expected).toBeUndefined()
    }
  })
})

describe('handleRunOnly', () => {
  it('emits raw stdout per input with no verdict, then run_complete', async () => {
    const { py } = scriptedPyodide(['a\n', 'b\n'])
    const { messages, post } = collector()

    await handleRunOnly(
      py,
      { type: 'run_only', code: 'print(input())', inputs: ['x', 'y'] },
      post,
    )

    const results = messages.filter((m) => m.type === 'testcase_result')
    expect(results).toHaveLength(2)
    for (const r of results) {
      expect(r).not.toHaveProperty('verdict')
    }
    expect(results[0]).toMatchObject({ index: 0, stdout: 'a\n' })
    expect(results[1]).toMatchObject({ index: 1, stdout: 'b\n' })

    const complete = messages[messages.length - 1]!
    expect(complete.type).toBe('run_complete')
    expect(complete).not.toHaveProperty('total')
  })

  it('captures a per-input error without aborting the batch', async () => {
    const { py } = scriptedPyodide([new Error('boom'), 'ok\n'])
    const { messages, post } = collector()

    await handleRunOnly(py, { type: 'run_only', code: 'x', inputs: ['1', '2'] }, post)

    const first = messages[0]!
    if (first.type === 'testcase_result' && 'stdout' in first) {
      expect(first.stdout).toBe('')
      expect(first.error).toContain('boom')
    }
    const second = messages[1]!
    if (second.type === 'testcase_result' && 'stdout' in second) {
      expect(second.stdout).toBe('ok\n')
    }
  })
})

describe('handleGenerate', () => {
  it('produces plain and JSON-factory testcases and records generator errors', async () => {
    const { py } = scriptedPyodide([
      'KHOOR', // plain expected output
      JSON.stringify({ input: 'Z', expected_output: 'A' }), // factory format
      new Error('SyntaxError: bad'), // generator error
    ])
    const { messages, post } = collector()

    await handleGenerate(
      py,
      { type: 'generate', generatorCode: 'g', inputs: ['HELLO', 'orig', 'BAD'] },
      post,
    )

    expect(messages).toHaveLength(1)
    const msg = messages[0]!
    expect(msg.type).toBe('generate_complete')
    if (msg.type === 'generate_complete') {
      expect(msg.testcases[0]).toEqual({ input: 'HELLO', expected_output: 'KHOOR' })
      expect(msg.testcases[1]).toEqual({ input: 'Z', expected_output: 'A' })
      expect(msg.testcases[2]?.error).toContain('SyntaxError')
      expect(msg.testcases[2]?.expected_output).toBe('')
    }
  })
})
