<script setup lang="ts">
/**
 * CodeMirrorEditor — the default {@link ../EditorAdapter EditorAdapter}
 * implementation, backed by CodeMirror 6 (task 5.2).
 *
 * Self-contained styling
 * ----------------------
 * Unlike the original source component, this adapter makes NO assumption that
 * the consumer uses Tailwind. All layout, sizing and the loading skeleton are
 * provided by the scoped `<style>` block below as plain CSS, so the editor
 * drops into any VitePress / Vue project unchanged.
 *
 * SSR safety (task 5.4)
 * ---------------------
 * CodeMirror is a browser-only library. It is therefore loaded with a dynamic
 * `import()` *inside* `onMounted`, which only runs on the client — never during
 * SSR / SSG. There is NO module-scope access to `window`, `document`,
 * `ResizeObserver`, or any other browser-only global, so importing this `.vue`
 * during a server build is side-effect free. The component still renders its
 * static container + skeleton markup on the server; the live editor is attached
 * after hydration.
 */
import { ref, onMounted, onUnmounted, watch } from 'vue'
import type { EditorView } from '@codemirror/view'
import { pythonStdlibCompletions } from './pythonCompletions'

const props = withDefaults(
  defineProps<{
    /** Source code (v-model value). */
    modelValue: string
    /** Language hint. Only 'python' is wired up today, but the prop is accepted. */
    language?: string
    /** Render the document as non-editable when true. */
    readOnly?: boolean
  }>(),
  {
    language: 'python',
    readOnly: false,
  },
)

const emit = defineEmits<{ (e: 'update:modelValue', value: string): void }>()

const containerRef = ref<HTMLElement | null>(null)
const isLoading = ref(true)
let editor: EditorView | null = null
let resizeObserver: ResizeObserver | null = null

onMounted(async () => {
  // `onMounted` only fires on the client, so everything below is SSR-safe.
  if (!containerRef.value) return

  // Lazy-load CodeMirror to avoid bundle bloat in the initial chunk and to keep
  // the browser-only modules out of the SSR/SSG code path.
  const [
    { EditorView, keymap, lineNumbers, drawSelection, dropCursor, rectangularSelection },
    { defaultKeymap, history, historyKeymap, indentWithTab },
    { python, pythonLanguage },
    { oneDark },
    { EditorState },
    { autocompletion, closeBrackets, closeBracketsKeymap },
  ] = await Promise.all([
    import('@codemirror/view'),
    import('@codemirror/commands'),
    import('@codemirror/lang-python'),
    import('@codemirror/theme-one-dark'),
    import('@codemirror/state'),
    import('@codemirror/autocomplete'),
  ])

  // Re-check after the async import: the component may have unmounted.
  if (!containerRef.value) return

  editor = new EditorView({
    state: EditorState.create({
      doc: props.modelValue,
      extensions: [
        lineNumbers(),
        history(),
        drawSelection(),
        dropCursor(),
        rectangularSelection(),
        EditorState.tabSize.of(4),
        // `language` currently only supports Python; the prop is accepted for
        // forward-compatibility with other adapters/languages.
        python(),
        pythonLanguage.data.of({ autocomplete: pythonStdlibCompletions() }),
        autocompletion(),
        closeBrackets(),
        keymap.of([...closeBracketsKeymap, indentWithTab, ...defaultKeymap, ...historyKeymap]),
        oneDark,
        // Wire the readOnly prop to both the document state and the view so the
        // cursor/selection are also disabled.
        EditorState.readOnly.of(props.readOnly),
        EditorView.editable.of(!props.readOnly),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            emit('update:modelValue', update.state.doc.toString())
          }
        }),
        EditorView.theme({
          '&': { height: '100%', fontSize: '14px' },
          '.cm-scroller': { overflow: 'auto', fontFamily: 'monospace' },
        }),
      ],
    }),
    parent: containerRef.value,
  })

  // ResizeObserver replaces Monaco's automaticLayout. Guarded so that any
  // environment lacking it (older/headless runtimes) degrades gracefully.
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      editor?.requestMeasure()
    })
    resizeObserver.observe(containerRef.value)
  }

  isLoading.value = false
})

// Sync external model changes (e.g., when starter code is loaded)
watch(
  () => props.modelValue,
  (newVal) => {
    if (!editor) return
    const current = editor.state.doc.toString()
    if (current !== newVal) {
      editor.dispatch({
        changes: { from: 0, to: current.length, insert: newVal },
      })
    }
  },
)

onUnmounted(() => {
  resizeObserver?.disconnect()
  editor?.destroy()
})
</script>

<template>
  <div class="cm-editor-host">
    <!-- Skeleton overlay while CodeMirror lazy-imports; container must always exist in DOM -->
    <div v-if="isLoading" class="cm-editor-skeleton" />
    <div ref="containerRef" class="cm-editor-mount" />
  </div>
</template>

<style scoped>
/* Self-contained styling — no Tailwind / consumer utility classes required. */
.cm-editor-host {
  position: relative;
  /* Fill the parent when it has a height; otherwise fall back to a usable size. */
  height: 100%;
  width: 100%;
  min-height: 200px;
}

.cm-editor-mount {
  height: 100%;
  width: 100%;
}

.cm-editor-skeleton {
  position: absolute;
  inset: 0;
  z-index: 10;
  border-radius: 4px;
  background-color: #1f2937; /* matches the one-dark surface so the swap is seamless */
  animation: cm-editor-pulse 1.5s ease-in-out infinite;
}

@keyframes cm-editor-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
</style>
