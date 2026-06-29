# random-input-generator Specification

## Purpose

TBD - created by archiving change 'extract-vitepress-code-runner'. Update Purpose after archive.

## Requirements

### Requirement: Generate random stdin inputs from a parameter specification
The generator SHALL accept a JSON parameter specification and a count, and SHALL return that many random standard-input strings conforming to the specification.

#### Scenario: Generate N inputs
- **WHEN** the host calls the generator with a parameter specification and count N
- **THEN** the generator SHALL return exactly N input strings, each conforming to the specification

##### Example: integer parameter within bounds
- **GIVEN** specification {"shift": {"type": "int", "min": 1, "max": 25}} and count 5
- **WHEN** the generator runs
- **THEN** it SHALL return 5 strings, each a single integer in the inclusive range 1 to 25


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
### Requirement: Decoupled from the encrypted pool and judge logic
The generator module SHALL NOT depend on the encrypted testcase-pool, decryption, or judge code, and its compiled artifact SHALL NOT include the AES-GCM cryptography dependency.

#### Scenario: Generator artifact excludes crypto
- **WHEN** the generator crate is compiled to WASM
- **THEN** the artifact SHALL provide input generation without linking the encrypted-pool or AES-GCM code


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
### Requirement: Report generation failures explicitly
The generator SHALL return a recognizable error when the parameter specification is invalid, and SHALL NOT fail silently.

#### Scenario: Invalid specification
- **WHEN** the host passes a malformed parameter specification
- **THEN** the generator SHALL surface an error that the host can detect and display

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