# pluggable-code-editor Specification

## Purpose

TBD - created by archiving change 'extract-vitepress-code-runner'. Update Purpose after archive.

## Requirements

### Requirement: Language-agnostic editor adapter contract
The library SHALL define an editor adapter contract that exposes the code as a two-way bound string value and accepts a language identifier and a read-only flag, independent of any specific editor implementation.

#### Scenario: Adapter exposes code via two-way binding
- **WHEN** the host binds a value to an editor adapter and the user edits the code
- **THEN** the adapter SHALL update the bound value, and external updates to the bound value SHALL update the editor content


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
### Requirement: Default CodeMirror adapter
The library SHALL provide a default CodeMirror adapter whose behavior is equivalent to the source editor, including lazy loading, a loading placeholder, and Python autocompletion.

#### Scenario: Default editor renders and edits Python
- **WHEN** a host uses the runner without specifying an editor
- **THEN** the CodeMirror adapter SHALL load, display Python code with autocompletion, and report edits through the adapter contract


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
### Requirement: Host can replace the editor implementation
The runner UI SHALL accept an injected editor component conforming to the adapter contract and SHALL use it in place of the default.

#### Scenario: Inject an alternative editor
- **WHEN** a host injects a custom editor component that conforms to the adapter contract
- **THEN** the runner SHALL use the injected editor and still read and update the code through the contract


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
### Requirement: Editor renders client-only
Editor implementations SHALL load only in the browser after mount and SHALL NOT execute during server-side rendering.

#### Scenario: Build under SSR
- **WHEN** the consuming VitePress site is built with SSR or SSG
- **THEN** the editor SHALL NOT access browser-only APIs during the server build

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