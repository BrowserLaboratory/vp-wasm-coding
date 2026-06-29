import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import CodeMirrorEditor from './CodeMirrorEditor.vue'

// ── Hoisted holders so vi.mock factories (themselves hoisted) can share state ──
const { listenerHolder, readOnlyHolder } = vi.hoisted(() => ({
  // Captures the EditorView.updateListener callback so the test can simulate an edit.
  listenerHolder: { cb: null as null | ((update: unknown) => void) },
  // Records the value passed to EditorState.readOnly.of(...) so we can assert wiring.
  readOnlyHolder: { value: undefined as unknown },
}))

// ── Stubs for CodeMirror modules (dynamically imported in onMounted) ──────────
vi.mock('@codemirror/autocomplete', () => ({
  closeBrackets: vi.fn(() => ({})),
  closeBracketsKeymap: [],
  autocompletion: vi.fn(() => ({})),
}))

vi.mock('@codemirror/view', () => {
  class EditorView {
    static updateListener = {
      of: vi.fn((cb: (update: unknown) => void) => {
        listenerHolder.cb = cb
        return {}
      }),
    }
    static editable = { of: vi.fn(() => ({})) }
    static theme = vi.fn(() => ({}))
    requestMeasure = vi.fn()
    destroy = vi.fn()
    state = { doc: { toString: () => '' } }
    dispatch = vi.fn()
    constructor() {}
  }
  return {
    EditorView,
    keymap: { of: vi.fn(() => ({})) },
    lineNumbers: vi.fn(() => ({})),
    drawSelection: vi.fn(() => ({})),
    dropCursor: vi.fn(() => ({})),
    rectangularSelection: vi.fn(() => ({})),
  }
})

vi.mock('@codemirror/commands', () => ({
  defaultKeymap: [],
  history: vi.fn(() => ({})),
  historyKeymap: [],
  indentWithTab: {},
}))

vi.mock('@codemirror/lang-python', () => ({
  python: vi.fn(() => ({})),
  pythonLanguage: { data: { of: vi.fn(() => ({})) } },
}))

vi.mock('@codemirror/theme-one-dark', () => ({ oneDark: {} }))

vi.mock('@codemirror/state', () => ({
  EditorState: {
    create: vi.fn(() => ({})),
    tabSize: { of: vi.fn(() => ({})) },
    readOnly: {
      of: vi.fn((value: unknown) => {
        readOnlyHolder.value = value
        return {}
      }),
    },
  },
}))

vi.stubGlobal(
  'ResizeObserver',
  class {
    observe = vi.fn()
    disconnect = vi.fn()
  },
)

// ──────────────────────────────────────────────────────────────────────────────

describe('CodeMirrorEditor (EditorAdapter)', () => {
  beforeEach(() => {
    // The mocked CodeMirror modules are shared across tests; reset the captured
    // state so each test observes only its own mount.
    listenerHolder.cb = null
    readOnlyHolder.value = undefined
  })

  it('shows the loading skeleton before CodeMirror resolves', () => {
    const wrapper = mount(CodeMirrorEditor, { props: { modelValue: '' } })
    expect(wrapper.find('.cm-editor-skeleton').exists()).toBe(true)
  })

  it('hides the skeleton once the editor is built', async () => {
    const wrapper = mount(CodeMirrorEditor, { props: { modelValue: '' } })
    await vi.waitFor(
      () => {
        expect(wrapper.find('.cm-editor-skeleton').exists()).toBe(false)
      },
      { timeout: 2000 },
    )
  })

  it('emits update:modelValue with the new value when the document changes', async () => {
    const wrapper = mount(CodeMirrorEditor, { props: { modelValue: 'print(1)' } })

    // Wait until onMounted's lazy imports resolve and the update listener is wired.
    await vi.waitFor(() => {
      expect(listenerHolder.cb).toBeTypeOf('function')
    }, { timeout: 2000 })

    // Drive an edit by invoking the captured CodeMirror update listener.
    listenerHolder.cb!({
      docChanged: true,
      state: { doc: { toString: () => 'print(2)' } },
    })

    const emitted = wrapper.emitted('update:modelValue')
    expect(emitted).toBeTruthy()
    expect(emitted![0]).toEqual(['print(2)'])
  })

  it('does not emit when the update did not change the document', async () => {
    const wrapper = mount(CodeMirrorEditor, { props: { modelValue: 'print(1)' } })
    await vi.waitFor(() => {
      expect(listenerHolder.cb).toBeTypeOf('function')
    }, { timeout: 2000 })

    listenerHolder.cb!({
      docChanged: false,
      state: { doc: { toString: () => 'ignored' } },
    })

    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('wires the readOnly prop through to CodeMirror EditorState.readOnly', async () => {
    mount(CodeMirrorEditor, { props: { modelValue: '', readOnly: true } })
    await vi.waitFor(() => {
      expect(readOnlyHolder.value).toBe(true)
    }, { timeout: 2000 })
  })
})
