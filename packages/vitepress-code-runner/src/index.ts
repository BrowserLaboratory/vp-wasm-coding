/**
 * @cxphoenix/vp-wasm-coding — VitePress packaging layer for the pure-TS
 * `@cxphoenix/vp-wasm-coding-core` Python execution engine.
 *
 * Ships an SSR-safe `CodeRunner` component, the Vue composables that hold the
 * reactivity, the pluggable editor host (default CodeMirror), and a configurable
 * asset base. The Vite plugin lives at the `./vite` subpath export and the
 * package CSS at `./style.css`.
 *
 * SECURITY: the runner does NOT safely sandbox hostile code. The real boundary
 * is Worker isolation + a `connect-src 'self'` CSP + `worker.terminate()`. See
 * SECURITY.md. The Python-level import blocklist / op-counter are best-effort
 * only and are NOT security guarantees.
 */

// ── Main component ────────────────────────────────────────────────────────────
export { default as CodeRunner } from './components/CodeRunner.vue'

// ── Composables (Vue reactivity layer) ─────────────────────────────────────────
export { useCodeRunner } from './composables/useCodeRunner'
export type {
  RunnerStatus,
  UseCodeRunnerOptions,
  UseCodeRunnerReturn,
} from './composables/useCodeRunner'

export { useWasmGenerator, resetWasmGeneratorCache } from './composables/useWasmGenerator'
export type {
  GeneratedInputs,
  WasmGeneratorModule,
  UseWasmGeneratorOptions,
} from './composables/useWasmGenerator'

// ── Configurable asset base (task 6.2) ─────────────────────────────────────────
export {
  resolveBaseUrl,
  resolvePyodideIndexURL,
  resolveGeneratorBase,
  resolveGeneratorGlueURL,
  provideCodeRunnerConfig,
  injectCodeRunnerConfig,
  CODE_RUNNER_CONFIG_KEY,
  DEFAULT_PYODIDE_DIR,
  DEFAULT_GENERATOR_DIR,
  DEFAULT_GENERATOR_GLUE,
} from './config'
export type { AssetBaseConfig } from './config'

// ── Editor layer ───────────────────────────────────────────────────────────────
export { default as EditorHost } from './editors/EditorHost.vue'
export { DEFAULT_EDITOR_LANGUAGE } from './editors/EditorAdapter'
export type {
  EditorAdapter,
  EditorAdapterProps,
  EditorAdapterEmits,
} from './editors/EditorAdapter'
export { CodeMirrorEditor, pythonStdlibCompletions } from './editors/codemirror'

// ── Re-exported core types consumers commonly need ──────────────────────────────
export type { Testcase, TestcaseResult, RunSummary, VerdictDetail } from '@cxphoenix/vp-wasm-coding-core'
