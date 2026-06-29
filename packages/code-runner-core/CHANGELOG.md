# @cxphoenix/vp-wasm-coding-core

## 0.1.0

### Minor Changes

- 8344ec1: Initial public release.

  A client-side Python coding playground for VitePress: runs Python in an isolated
  Pyodide Web Worker with AC/WA/RE/TLE verdicts, a bundled Rust→WASM random-input
  generator (`generate_challenge`), and a pluggable editor (default CodeMirror).
  Works on a plain static host — no COOP/COEP required.

  - `@cxphoenix/vp-wasm-coding` — VitePress component, composables, configurable
    asset base, and the `codeRunnerAssets` Vite plugin.
  - `@cxphoenix/vp-wasm-coding-core` — framework-agnostic Pyodide execution engine.
