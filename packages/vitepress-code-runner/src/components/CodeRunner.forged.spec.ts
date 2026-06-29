import { describe, it, expect, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'

/**
 * Robustness: untrusted Python in the worker can forge a worker→main message
 * via the `js` FFI, including a non-number `elapsed_ms`. The results table must
 * render it safely (placeholder) instead of throwing on `.toFixed()`.
 */
vi.mock('@vp-code-runner/core', () => {
  const forged = [
    // elapsed_ms deliberately NOT a number — as a forged message could deliver.
    { type: 'testcase_result', index: 0, verdict: 'AC', elapsed_ms: 'not-a-number' as unknown as number },
  ]
  const summary = { results: forged, total: 1, passed: 1, status: 'done' as const }
  const streamingRun = () =>
    vi.fn(async (_c: string, _t: unknown[], options?: { onResult?: (r: unknown) => void }) => {
      for (const r of forged) options?.onResult?.(r)
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

const StubEditor = defineComponent({
  name: 'StubEditor',
  props: { modelValue: { type: String, default: '' } },
  emits: ['update:modelValue'],
  setup(props) {
    return () => h('textarea', { 'value': props.modelValue, 'data-testid': 'stub-editor' })
  },
})

describe('CodeRunner — forged worker message robustness', () => {
  it('renders without throwing when elapsed_ms is not a number', async () => {
    const wrapper = mount(CodeRunner, {
      props: {
        editor: StubEditor,
        starterCode: 'x',
        testcases: [{ input: '1', expected_output: '1' }],
      },
    })

    await wrapper.find('[data-testid="run-button"]').trigger('click')
    await flushPromises()

    const rows = wrapper.findAll('[data-testid="result-row"]')
    expect(rows).toHaveLength(1)
    // Time cell falls back to the em-dash placeholder instead of crashing.
    expect(wrapper.text()).toContain('— ms')
  })
})
