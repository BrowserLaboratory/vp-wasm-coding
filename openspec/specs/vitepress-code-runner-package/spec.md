# vitepress-code-runner-package Specification

## Purpose

TBD - created by archiving change 'extract-vitepress-code-runner'. Update Purpose after archive.

## Requirements

### Requirement: SSR-safe components and composables for VitePress
The package SHALL expose components and composables that a VitePress project can register and use, and that load browser-only resources only after mount.

#### Scenario: Use the runner in a VitePress page
- **WHEN** a VitePress project registers the runner and renders it in a page
- **THEN** the page SHALL build without server-side errors and the runner SHALL become interactive in the browser


<!-- @trace
source: extract-vitepress-code-runner
updated: 2026-06-29
code:
  - examples/vitepress-basic/.vitepress/theme/index.ts
  - packages/vitepress-code-runner/src/composables/useCodeRunner.ts
  - packages/vitepress-code-runner/src/editors/EditorHost.vue
  - packages/vitepress-code-runner/src/vite/plugin.ts
  - packages/vitepress-code-runner/README.md
  - packages/code-runner-core/package.json
  - packages/vitepress-code-runner/src/editors/codemirror/pythonCompletions.ts
  - packages/code-runner-core/src/worker/worker-utils.ts
  - packages/vitepress-code-runner/package.json
  - packages/vitepress-code-runner/src/index.ts
  - packages/vitepress-code-runner/src/editors/codemirror/index.ts
  - packages/code-runner-core/src/runtime/executor.ts
  - packages/vitepress-code-runner/src/editors/EditorAdapter.ts
  - pnpm-workspace.yaml
  - packages/vitepress-code-runner/src/style.css
  - packages/vitepress-code-runner/src/composables/useWasmGenerator.ts
  - examples/vitepress-basic/.vitepress/config.ts
  - crates/random-input-generator/src/lib.rs
  - crates/random-input-generator/src/parser.rs
  - crates/random-input-generator/src/rng.rs
  - packages/vitepress-code-runner/SECURITY.md
  - packages/vitepress-code-runner/tsconfig.json
  - package.json
  - packages/vitepress-code-runner/src/editors/codemirror/CodeMirrorEditor.vue
  - tsconfig.json
  - packages/code-runner-core/src/worker/pyodide.worker.ts
  - packages/vitepress-code-runner/src/components/CodeRunner.vue
  - packages/vitepress-code-runner/src/config.ts
  - packages/code-runner-core/src/worker/messages.ts
  - .npmrc
  - examples/vitepress-basic/index.md
  - packages/vitepress-code-runner/src/shims-vue.d.ts
  - packages/vitepress-code-runner/vitest.config.ts
  - crates/random-input-generator/Cargo.toml
  - examples/vitepress-basic/package.json
  - packages/code-runner-core/vitest.config.ts
  - packages/code-runner-core/src/index.ts
  - packages/vitepress-code-runner/scripts/download-pyodide.sh
  - packages/code-runner-core/src/runtime/runner.ts
tests:
  - packages/code-runner-core/src/__tests__/pyodide-worker-verdict-detail.spec.ts
  - packages/vitepress-code-runner/src/editors/codemirror/CodeMirrorEditor.spec.ts
  - packages/code-runner-core/src/__tests__/worker-utils.spec.ts
  - packages/vitepress-code-runner/src/composables/useCodeRunner.spec.ts
  - packages/vitepress-code-runner/src/editors/EditorHost.spec.ts
  - packages/code-runner-core/src/__tests__/pyodide-worker-run-only.spec.ts
  - packages/vitepress-code-runner/src/components/CodeRunner.forged.spec.ts
  - packages/code-runner-core/src/__tests__/runner-dev.spec.ts
  - packages/code-runner-core/src/__tests__/pyodide-worker-behavior.spec.ts
  - packages/code-runner-core/src/__tests__/executor.spec.ts
  - packages/code-runner-core/src/__tests__/pyodide-worker-execute.spec.ts
  - packages/vitepress-code-runner/src/composables/useWasmGenerator.spec.ts
  - packages/code-runner-core/src/__tests__/pyodide-worker-generate.spec.ts
  - packages/vitepress-code-runner/src/components/CodeRunner.spec.ts
-->

---
### Requirement: Configurable asset base
The package SHALL resolve the Pyodide runtime and generator WASM assets through a configurable base location and SHALL NOT require a hardcoded root-absolute path.

#### Scenario: Non-root base path
- **WHEN** the consuming site is served under a non-root base path
- **THEN** the runner SHALL resolve and load its runtime assets correctly


<!-- @trace
source: extract-vitepress-code-runner
updated: 2026-06-29
code:
  - examples/vitepress-basic/.vitepress/theme/index.ts
  - packages/vitepress-code-runner/src/composables/useCodeRunner.ts
  - packages/vitepress-code-runner/src/editors/EditorHost.vue
  - packages/vitepress-code-runner/src/vite/plugin.ts
  - packages/vitepress-code-runner/README.md
  - packages/code-runner-core/package.json
  - packages/vitepress-code-runner/src/editors/codemirror/pythonCompletions.ts
  - packages/code-runner-core/src/worker/worker-utils.ts
  - packages/vitepress-code-runner/package.json
  - packages/vitepress-code-runner/src/index.ts
  - packages/vitepress-code-runner/src/editors/codemirror/index.ts
  - packages/code-runner-core/src/runtime/executor.ts
  - packages/vitepress-code-runner/src/editors/EditorAdapter.ts
  - pnpm-workspace.yaml
  - packages/vitepress-code-runner/src/style.css
  - packages/vitepress-code-runner/src/composables/useWasmGenerator.ts
  - examples/vitepress-basic/.vitepress/config.ts
  - crates/random-input-generator/src/lib.rs
  - crates/random-input-generator/src/parser.rs
  - crates/random-input-generator/src/rng.rs
  - packages/vitepress-code-runner/SECURITY.md
  - packages/vitepress-code-runner/tsconfig.json
  - package.json
  - packages/vitepress-code-runner/src/editors/codemirror/CodeMirrorEditor.vue
  - tsconfig.json
  - packages/code-runner-core/src/worker/pyodide.worker.ts
  - packages/vitepress-code-runner/src/components/CodeRunner.vue
  - packages/vitepress-code-runner/src/config.ts
  - packages/code-runner-core/src/worker/messages.ts
  - .npmrc
  - examples/vitepress-basic/index.md
  - packages/vitepress-code-runner/src/shims-vue.d.ts
  - packages/vitepress-code-runner/vitest.config.ts
  - crates/random-input-generator/Cargo.toml
  - examples/vitepress-basic/package.json
  - packages/code-runner-core/vitest.config.ts
  - packages/code-runner-core/src/index.ts
  - packages/vitepress-code-runner/scripts/download-pyodide.sh
  - packages/code-runner-core/src/runtime/runner.ts
tests:
  - packages/code-runner-core/src/__tests__/pyodide-worker-verdict-detail.spec.ts
  - packages/vitepress-code-runner/src/editors/codemirror/CodeMirrorEditor.spec.ts
  - packages/code-runner-core/src/__tests__/worker-utils.spec.ts
  - packages/vitepress-code-runner/src/composables/useCodeRunner.spec.ts
  - packages/vitepress-code-runner/src/editors/EditorHost.spec.ts
  - packages/code-runner-core/src/__tests__/pyodide-worker-run-only.spec.ts
  - packages/vitepress-code-runner/src/components/CodeRunner.forged.spec.ts
  - packages/code-runner-core/src/__tests__/runner-dev.spec.ts
  - packages/code-runner-core/src/__tests__/pyodide-worker-behavior.spec.ts
  - packages/code-runner-core/src/__tests__/executor.spec.ts
  - packages/code-runner-core/src/__tests__/pyodide-worker-execute.spec.ts
  - packages/vitepress-code-runner/src/composables/useWasmGenerator.spec.ts
  - packages/code-runner-core/src/__tests__/pyodide-worker-generate.spec.ts
  - packages/vitepress-code-runner/src/components/CodeRunner.spec.ts
-->

---
### Requirement: Vite plugin makes assets available in dev and build
The package SHALL provide a Vite plugin that makes the required runtime assets resolvable in both the dev server and the production build without manual copying by the consumer.

#### Scenario: Assets resolve in dev and preview
- **WHEN** the consuming site runs the dev server and the production preview
- **THEN** the runtime assets SHALL be resolvable in both modes


<!-- @trace
source: extract-vitepress-code-runner
updated: 2026-06-29
code:
  - examples/vitepress-basic/.vitepress/theme/index.ts
  - packages/vitepress-code-runner/src/composables/useCodeRunner.ts
  - packages/vitepress-code-runner/src/editors/EditorHost.vue
  - packages/vitepress-code-runner/src/vite/plugin.ts
  - packages/vitepress-code-runner/README.md
  - packages/code-runner-core/package.json
  - packages/vitepress-code-runner/src/editors/codemirror/pythonCompletions.ts
  - packages/code-runner-core/src/worker/worker-utils.ts
  - packages/vitepress-code-runner/package.json
  - packages/vitepress-code-runner/src/index.ts
  - packages/vitepress-code-runner/src/editors/codemirror/index.ts
  - packages/code-runner-core/src/runtime/executor.ts
  - packages/vitepress-code-runner/src/editors/EditorAdapter.ts
  - pnpm-workspace.yaml
  - packages/vitepress-code-runner/src/style.css
  - packages/vitepress-code-runner/src/composables/useWasmGenerator.ts
  - examples/vitepress-basic/.vitepress/config.ts
  - crates/random-input-generator/src/lib.rs
  - crates/random-input-generator/src/parser.rs
  - crates/random-input-generator/src/rng.rs
  - packages/vitepress-code-runner/SECURITY.md
  - packages/vitepress-code-runner/tsconfig.json
  - package.json
  - packages/vitepress-code-runner/src/editors/codemirror/CodeMirrorEditor.vue
  - tsconfig.json
  - packages/code-runner-core/src/worker/pyodide.worker.ts
  - packages/vitepress-code-runner/src/components/CodeRunner.vue
  - packages/vitepress-code-runner/src/config.ts
  - packages/code-runner-core/src/worker/messages.ts
  - .npmrc
  - examples/vitepress-basic/index.md
  - packages/vitepress-code-runner/src/shims-vue.d.ts
  - packages/vitepress-code-runner/vitest.config.ts
  - crates/random-input-generator/Cargo.toml
  - examples/vitepress-basic/package.json
  - packages/code-runner-core/vitest.config.ts
  - packages/code-runner-core/src/index.ts
  - packages/vitepress-code-runner/scripts/download-pyodide.sh
  - packages/code-runner-core/src/runtime/runner.ts
tests:
  - packages/code-runner-core/src/__tests__/pyodide-worker-verdict-detail.spec.ts
  - packages/vitepress-code-runner/src/editors/codemirror/CodeMirrorEditor.spec.ts
  - packages/code-runner-core/src/__tests__/worker-utils.spec.ts
  - packages/vitepress-code-runner/src/composables/useCodeRunner.spec.ts
  - packages/vitepress-code-runner/src/editors/EditorHost.spec.ts
  - packages/code-runner-core/src/__tests__/pyodide-worker-run-only.spec.ts
  - packages/vitepress-code-runner/src/components/CodeRunner.forged.spec.ts
  - packages/code-runner-core/src/__tests__/runner-dev.spec.ts
  - packages/code-runner-core/src/__tests__/pyodide-worker-behavior.spec.ts
  - packages/code-runner-core/src/__tests__/executor.spec.ts
  - packages/code-runner-core/src/__tests__/pyodide-worker-execute.spec.ts
  - packages/vitepress-code-runner/src/composables/useWasmGenerator.spec.ts
  - packages/code-runner-core/src/__tests__/pyodide-worker-generate.spec.ts
  - packages/vitepress-code-runner/src/components/CodeRunner.spec.ts
-->

---
### Requirement: Works on a static host without special headers
The package SHALL function on a static host that sets no COOP or COEP headers.

#### Scenario: Deploy to a static host
- **WHEN** the consuming site is deployed to a static host without COOP or COEP
- **THEN** Python execution and input generation SHALL work


<!-- @trace
source: extract-vitepress-code-runner
updated: 2026-06-29
code:
  - examples/vitepress-basic/.vitepress/theme/index.ts
  - packages/vitepress-code-runner/src/composables/useCodeRunner.ts
  - packages/vitepress-code-runner/src/editors/EditorHost.vue
  - packages/vitepress-code-runner/src/vite/plugin.ts
  - packages/vitepress-code-runner/README.md
  - packages/code-runner-core/package.json
  - packages/vitepress-code-runner/src/editors/codemirror/pythonCompletions.ts
  - packages/code-runner-core/src/worker/worker-utils.ts
  - packages/vitepress-code-runner/package.json
  - packages/vitepress-code-runner/src/index.ts
  - packages/vitepress-code-runner/src/editors/codemirror/index.ts
  - packages/code-runner-core/src/runtime/executor.ts
  - packages/vitepress-code-runner/src/editors/EditorAdapter.ts
  - pnpm-workspace.yaml
  - packages/vitepress-code-runner/src/style.css
  - packages/vitepress-code-runner/src/composables/useWasmGenerator.ts
  - examples/vitepress-basic/.vitepress/config.ts
  - crates/random-input-generator/src/lib.rs
  - crates/random-input-generator/src/parser.rs
  - crates/random-input-generator/src/rng.rs
  - packages/vitepress-code-runner/SECURITY.md
  - packages/vitepress-code-runner/tsconfig.json
  - package.json
  - packages/vitepress-code-runner/src/editors/codemirror/CodeMirrorEditor.vue
  - tsconfig.json
  - packages/code-runner-core/src/worker/pyodide.worker.ts
  - packages/vitepress-code-runner/src/components/CodeRunner.vue
  - packages/vitepress-code-runner/src/config.ts
  - packages/code-runner-core/src/worker/messages.ts
  - .npmrc
  - examples/vitepress-basic/index.md
  - packages/vitepress-code-runner/src/shims-vue.d.ts
  - packages/vitepress-code-runner/vitest.config.ts
  - crates/random-input-generator/Cargo.toml
  - examples/vitepress-basic/package.json
  - packages/code-runner-core/vitest.config.ts
  - packages/code-runner-core/src/index.ts
  - packages/vitepress-code-runner/scripts/download-pyodide.sh
  - packages/code-runner-core/src/runtime/runner.ts
tests:
  - packages/code-runner-core/src/__tests__/pyodide-worker-verdict-detail.spec.ts
  - packages/vitepress-code-runner/src/editors/codemirror/CodeMirrorEditor.spec.ts
  - packages/code-runner-core/src/__tests__/worker-utils.spec.ts
  - packages/vitepress-code-runner/src/composables/useCodeRunner.spec.ts
  - packages/vitepress-code-runner/src/editors/EditorHost.spec.ts
  - packages/code-runner-core/src/__tests__/pyodide-worker-run-only.spec.ts
  - packages/vitepress-code-runner/src/components/CodeRunner.forged.spec.ts
  - packages/code-runner-core/src/__tests__/runner-dev.spec.ts
  - packages/code-runner-core/src/__tests__/pyodide-worker-behavior.spec.ts
  - packages/code-runner-core/src/__tests__/executor.spec.ts
  - packages/code-runner-core/src/__tests__/pyodide-worker-execute.spec.ts
  - packages/vitepress-code-runner/src/composables/useWasmGenerator.spec.ts
  - packages/code-runner-core/src/__tests__/pyodide-worker-generate.spec.ts
  - packages/vitepress-code-runner/src/components/CodeRunner.spec.ts
-->

---
### Requirement: Documented security boundary
The package documentation SHALL state that the real security boundary is Worker isolation, the Content-Security-Policy connect-src restriction, and worker termination, and SHALL NOT present Python-level import blocking as a security guarantee.

#### Scenario: Security documentation
- **WHEN** a consumer reads the package security documentation
- **THEN** it SHALL describe the Worker isolation and CSP boundary and SHALL NOT claim safe execution of hostile code via import blocking

<!-- @trace
source: extract-vitepress-code-runner
updated: 2026-06-29
code:
  - examples/vitepress-basic/.vitepress/theme/index.ts
  - packages/vitepress-code-runner/src/composables/useCodeRunner.ts
  - packages/vitepress-code-runner/src/editors/EditorHost.vue
  - packages/vitepress-code-runner/src/vite/plugin.ts
  - packages/vitepress-code-runner/README.md
  - packages/code-runner-core/package.json
  - packages/vitepress-code-runner/src/editors/codemirror/pythonCompletions.ts
  - packages/code-runner-core/src/worker/worker-utils.ts
  - packages/vitepress-code-runner/package.json
  - packages/vitepress-code-runner/src/index.ts
  - packages/vitepress-code-runner/src/editors/codemirror/index.ts
  - packages/code-runner-core/src/runtime/executor.ts
  - packages/vitepress-code-runner/src/editors/EditorAdapter.ts
  - pnpm-workspace.yaml
  - packages/vitepress-code-runner/src/style.css
  - packages/vitepress-code-runner/src/composables/useWasmGenerator.ts
  - examples/vitepress-basic/.vitepress/config.ts
  - crates/random-input-generator/src/lib.rs
  - crates/random-input-generator/src/parser.rs
  - crates/random-input-generator/src/rng.rs
  - packages/vitepress-code-runner/SECURITY.md
  - packages/vitepress-code-runner/tsconfig.json
  - package.json
  - packages/vitepress-code-runner/src/editors/codemirror/CodeMirrorEditor.vue
  - tsconfig.json
  - packages/code-runner-core/src/worker/pyodide.worker.ts
  - packages/vitepress-code-runner/src/components/CodeRunner.vue
  - packages/vitepress-code-runner/src/config.ts
  - packages/code-runner-core/src/worker/messages.ts
  - .npmrc
  - examples/vitepress-basic/index.md
  - packages/vitepress-code-runner/src/shims-vue.d.ts
  - packages/vitepress-code-runner/vitest.config.ts
  - crates/random-input-generator/Cargo.toml
  - examples/vitepress-basic/package.json
  - packages/code-runner-core/vitest.config.ts
  - packages/code-runner-core/src/index.ts
  - packages/vitepress-code-runner/scripts/download-pyodide.sh
  - packages/code-runner-core/src/runtime/runner.ts
tests:
  - packages/code-runner-core/src/__tests__/pyodide-worker-verdict-detail.spec.ts
  - packages/vitepress-code-runner/src/editors/codemirror/CodeMirrorEditor.spec.ts
  - packages/code-runner-core/src/__tests__/worker-utils.spec.ts
  - packages/vitepress-code-runner/src/composables/useCodeRunner.spec.ts
  - packages/vitepress-code-runner/src/editors/EditorHost.spec.ts
  - packages/code-runner-core/src/__tests__/pyodide-worker-run-only.spec.ts
  - packages/vitepress-code-runner/src/components/CodeRunner.forged.spec.ts
  - packages/code-runner-core/src/__tests__/runner-dev.spec.ts
  - packages/code-runner-core/src/__tests__/pyodide-worker-behavior.spec.ts
  - packages/code-runner-core/src/__tests__/executor.spec.ts
  - packages/code-runner-core/src/__tests__/pyodide-worker-execute.spec.ts
  - packages/vitepress-code-runner/src/composables/useWasmGenerator.spec.ts
  - packages/code-runner-core/src/__tests__/pyodide-worker-generate.spec.ts
  - packages/vitepress-code-runner/src/components/CodeRunner.spec.ts
-->