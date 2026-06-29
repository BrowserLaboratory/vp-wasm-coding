import type { DefineComponent } from 'vue'

/**
 * EditorAdapter — the language-agnostic editor adapter contract (task 5.1).
 *
 * Any code editor that the runner can host (CodeMirror today, Monaco or a
 * plain textarea tomorrow) MUST satisfy this contract. The contract is
 * deliberately tiny so that swapping the underlying editor implementation is a
 * one-line change in the host (see {@link ./EditorHost.vue}).
 *
 * Contract summary:
 * - Props: `modelValue` (the source code), optional `language`, optional `readOnly`.
 * - Emit:  `update:modelValue` whenever the user edits the document — this makes
 *          the component usable as a `v-model` target.
 *
 * Implementors written with `<script setup lang="ts">` can type their props
 * directly against {@link EditorAdapterProps} and their emits against
 * {@link EditorAdapterEmits}.
 */

/**
 * Props every editor adapter accepts.
 */
export interface EditorAdapterProps {
  /**
   * Current source code. This is the `v-model` value — the editor renders it
   * and reports changes back via the `update:modelValue` emit.
   */
  modelValue: string

  /**
   * Source language hint, e.g. `'python'`. Adapters MAY support only a subset
   * of languages but MUST accept the prop. Defaults to `'python'`.
   */
  language?: string

  /**
   * When `true`, the editor is rendered but the document cannot be edited.
   * Defaults to `false`.
   */
  readOnly?: boolean
}

/**
 * Events every editor adapter emits.
 *
 * Expressed in the Vue 3 "emit options as a type" shape so it composes with
 * `defineEmits<EditorAdapterEmits>()` in `<script setup>`.
 */
export interface EditorAdapterEmits {
  /** Fired with the new document text whenever the user edits the code. */
  (e: 'update:modelValue', value: string): void
}

/**
 * The default value for the optional `language` prop.
 */
export const DEFAULT_EDITOR_LANGUAGE = 'python'

/**
 * A Vue component type that conforms to the editor adapter contract.
 *
 * The host accepts any value of this type via its `editor` prop. Because Vue
 * SFCs are structurally components, both the bundled
 * {@link ./codemirror/CodeMirrorEditor.vue CodeMirrorEditor} and a hand-rolled
 * stub editor satisfy it.
 */
export type EditorAdapter = DefineComponent<EditorAdapterProps>
