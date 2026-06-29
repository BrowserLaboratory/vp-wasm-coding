import { describe, it, expect, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'

/**
 * Fake the core so the component test stays independent of real Pyodide /
 * CodeMirror. The executor streams two results (AC, WA) then completes.
 */
vi.mock('@cxphoenix/vp-wasm-coding-core', () => {
  const fakeResults = [
    { type: 'testcase_result', index: 0, verdict: 'AC', elapsed_ms: 3 },
    { type: 'testcase_result', index: 1, verdict: 'WA', elapsed_ms: 4, actual: '5', expected: '6' },
  ]
  const summary = { results: fakeResults, total: 2, passed: 1, status: 'done' as const }
  const streamingRun = () =>
    vi.fn(async (_c: string, _t: unknown[], options?: { onResult?: (r: unknown) => void }) => {
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
      runGenerator: vi.fn(),
      submit: streamingRun(),
      stop: vi.fn(),
      cleanup: vi.fn(),
      isRunning: () => false,
    })),
    WALL_CLOCK_KILL_MS: 6000,
  }
})

import CodeRunner from './CodeRunner.vue'

/** A textarea-based stub editor satisfying the EditorAdapter contract. */
const StubEditor = defineComponent({
  name: 'StubEditor',
  props: {
    modelValue: { type: String, default: '' },
    language: { type: String, default: 'python' },
    readOnly: { type: Boolean, default: false },
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () =>
      h('textarea', {
        'value': props.modelValue,
        'data-testid': 'stub-editor',
        'onInput': (e: Event) => emit('update:modelValue', (e.target as HTMLTextAreaElement).value),
      })
  },
})

describe('CodeRunner', () => {
  it('runs against testcases and renders per-testcase results', async () => {
    const wrapper = mount(CodeRunner, {
      props: {
        editor: StubEditor,
        starterCode: 'print(int(input()) * 2)',
        testcases: [
          { input: '1', expected_output: '2' },
          { input: '2', expected_output: '5' },
        ],
        verdictDetail: 'full',
      },
    })

    // The injected stub editor renders, seeded with the starter code.
    const editor = wrapper.find('[data-testid="stub-editor"]')
    expect(editor.exists()).toBe(true)
    expect((editor.element as HTMLTextAreaElement).value).toBe('print(int(input()) * 2)')

    // No results panel before running.
    expect(wrapper.find('[data-testid="result-panel"]').exists()).toBe(false)

    await wrapper.find('[data-testid="run-button"]').trigger('click')
    await flushPromises()

    const rows = wrapper.findAll('[data-testid="result-row"]')
    expect(rows).toHaveLength(2)
    expect(wrapper.find('[data-testid="result-panel"]').exists()).toBe(true)

    // Verdicts and summary rendered.
    expect(wrapper.text()).toContain('AC')
    expect(wrapper.text()).toContain('WA')
    expect(wrapper.find('[data-testid="summary"]').text()).toContain('1 / 2')
    // verdictDetail: 'full' surfaces expected/actual for the WA row.
    expect(wrapper.text()).toContain('5')
    expect(wrapper.text()).toContain('6')
  })

  it('shows an error when neither testcases nor generatorCode are provided', async () => {
    const wrapper = mount(CodeRunner, {
      props: { editor: StubEditor, starterCode: 'print(1)' },
    })

    await wrapper.find('[data-testid="run-button"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="error"]').exists()).toBe(true)
  })
})
