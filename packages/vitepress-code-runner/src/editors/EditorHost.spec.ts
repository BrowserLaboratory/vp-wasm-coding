import { describe, it, expect } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import EditorHost from './EditorHost.vue'

/**
 * A minimal editor that conforms to the EditorAdapter contract using a plain
 * <textarea>. It depends on nothing from CodeMirror, so these tests verify the
 * host's injection mechanism (task 5.3) in isolation.
 */
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
        'readOnly': props.readOnly,
        'data-language': props.language,
        'onInput': (e: Event) => emit('update:modelValue', (e.target as HTMLTextAreaElement).value),
      })
  },
})

describe('EditorHost (editor injection)', () => {
  it('renders the injected editor and reads code through the contract', () => {
    const wrapper = mount(EditorHost, {
      props: { modelValue: 'print("hi")', editor: StubEditor },
    })
    const textarea = wrapper.find('textarea')
    expect(textarea.exists()).toBe(true)
    expect((textarea.element as HTMLTextAreaElement).value).toBe('print("hi")')
  })

  it('updates code through the injected editor (update:modelValue bubbles up)', async () => {
    const wrapper = mount(EditorHost, {
      props: { modelValue: 'print(1)', editor: StubEditor },
    })

    await wrapper.find('textarea').setValue('print(2)')

    const emitted = wrapper.emitted('update:modelValue')
    expect(emitted).toBeTruthy()
    expect(emitted![0]).toEqual(['print(2)'])
  })

  it('round-trips the value back into the injected editor via v-model', async () => {
    const wrapper = mount(EditorHost, {
      props: { modelValue: 'a', editor: StubEditor },
    })
    // Simulate the parent updating modelValue in response to the emit.
    await wrapper.setProps({ modelValue: 'b' })
    expect((wrapper.find('textarea').element as HTMLTextAreaElement).value).toBe('b')
  })

  it('forwards language and readOnly to the injected editor', () => {
    const wrapper = mount(EditorHost, {
      props: { modelValue: '', editor: StubEditor, language: 'python', readOnly: true },
    })
    const textarea = wrapper.find('textarea').element as HTMLTextAreaElement
    expect(textarea.getAttribute('data-language')).toBe('python')
    expect(textarea.readOnly).toBe(true)
  })

  it('supports the #editor scoped slot as an escape hatch', async () => {
    const wrapper = mount(EditorHost, {
      props: { modelValue: 'slot-code' },
      slots: {
        editor: (slotProps: { modelValue: string; update: (v: string) => void }) =>
          h('input', {
            'class': 'slot-editor',
            'value': slotProps.modelValue,
            'onInput': (e: Event) => slotProps.update((e.target as HTMLInputElement).value),
          }),
      },
    })

    const input = wrapper.find('input.slot-editor')
    expect(input.exists()).toBe(true)
    expect((input.element as HTMLInputElement).value).toBe('slot-code')

    await input.setValue('edited-via-slot')
    expect(wrapper.emitted('update:modelValue')![0]).toEqual(['edited-via-slot'])
  })
})
