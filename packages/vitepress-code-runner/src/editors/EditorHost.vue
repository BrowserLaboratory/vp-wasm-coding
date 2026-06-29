<script setup lang="ts">
/**
 * EditorHost — the injection point that lets a consumer swap the editor
 * implementation (task 5.3).
 *
 * Two extension mechanisms are offered:
 *
 * 1. `editor` prop — pass any component conforming to the
 *    {@link ./EditorAdapter EditorAdapter} contract (props `modelValue` /
 *    `language` / `readOnly`, emit `update:modelValue`). It is rendered through
 *    a dynamic `<component :is>`. Defaults to the bundled
 *    {@link ./codemirror/CodeMirrorEditor.vue CodeMirrorEditor}.
 *
 * 2. `#editor` scoped slot — the escape hatch. When provided, it fully replaces
 *    the rendered editor and receives the live `modelValue` plus an `update`
 *    callback so the slot content can drive the same `v-model`.
 *
 * Either way the host forwards `modelValue` through to whichever editor is used
 * and re-emits its `update:modelValue`, so `EditorHost` itself is a `v-model`
 * target.
 */
import { computed } from 'vue'
import type { Component } from 'vue'
import type { EditorAdapter } from './EditorAdapter'
import { DEFAULT_EDITOR_LANGUAGE } from './EditorAdapter'
import { CodeMirrorEditor } from './codemirror'

const props = withDefaults(
  defineProps<{
    /** Source code (v-model value). */
    modelValue: string
    /** The editor component to render. Must satisfy the EditorAdapter contract. */
    editor?: EditorAdapter | Component
    /** Language hint forwarded to the editor. */
    language?: string
    /** Forwarded to the editor to make the document non-editable. */
    readOnly?: boolean
  }>(),
  {
    // Factory default: returns the bundled CodeMirror adapter component object.
    editor: () => CodeMirrorEditor,
    language: DEFAULT_EDITOR_LANGUAGE,
    readOnly: false,
  },
)

const emit = defineEmits<{ (e: 'update:modelValue', value: string): void }>()

/** Bridges the host's modelValue to the injected editor's v-model. */
const code = computed({
  get: () => props.modelValue,
  set: (value: string) => emit('update:modelValue', value),
})

function update(value: string): void {
  emit('update:modelValue', value)
}
</script>

<template>
  <!--
    Escape hatch: a `#editor` scoped slot fully replaces the injected component.
    Default slot content renders the injected (or default) editor adapter.
  -->
  <slot name="editor" :model-value="modelValue" :language="language" :read-only="readOnly" :update="update">
    <component :is="editor" v-model="code" :language="language" :read-only="readOnly" />
  </slot>
</template>
