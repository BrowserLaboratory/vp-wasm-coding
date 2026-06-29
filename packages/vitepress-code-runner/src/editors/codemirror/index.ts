/**
 * CodeMirror editor adapter — public entry point.
 *
 * `CodeMirrorEditor` is the default {@link ../EditorAdapter EditorAdapter}
 * implementation used by {@link ../EditorHost.vue EditorHost} when no other
 * editor is injected.
 */
export { default as CodeMirrorEditor } from './CodeMirrorEditor.vue'
export { pythonStdlibCompletions } from './pythonCompletions'
