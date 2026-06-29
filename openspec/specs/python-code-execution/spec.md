# python-code-execution Specification

## Purpose

TBD - created by archiving change 'extract-vitepress-code-runner'. Update Purpose after archive.

## Requirements

### Requirement: Execute Python in an isolated worker
The engine SHALL load a Pyodide runtime inside a dedicated module Web Worker and execute user-supplied Python there, isolated from the host page's DOM and main thread.

#### Scenario: Run user code in a worker
- **WHEN** the host requests execution of a Python snippet
- **THEN** the engine SHALL run it inside a Web Worker and return the program's standard output to the host


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
### Requirement: Enforce a hard time limit by terminating the worker
The engine SHALL enforce a configurable wall-clock budget per run and, when the budget is exceeded, SHALL terminate the worker and report a TLE verdict. Worker termination SHALL be the authoritative time-limit guarantee.

#### Scenario: Code exceeds the time budget
- **WHEN** executed user code does not finish within the configured wall-clock budget
- **THEN** the engine SHALL terminate the worker and report the affected testcase as TLE


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
### Requirement: Capture standard input and output
The engine SHALL supply a provided input string as the program's standard input and SHALL capture everything written to standard output for verdict comparison.

#### Scenario: Program reads input and writes output
- **WHEN** user code reads from standard input and prints a result
- **THEN** the engine SHALL feed the supplied input and return the captured standard output


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
### Requirement: Produce a verdict by comparing trimmed output
The engine SHALL compare captured output against expected output after trimming trailing whitespace, and SHALL classify each testcase as AC, WA, RE, or TLE.

#### Scenario: Compare output to expected
- **WHEN** a testcase finishes execution
- **THEN** the engine SHALL emit AC when trimmed output equals trimmed expected output, WA when it differs, RE when the program raises an uncaught error, and TLE when it is terminated for exceeding the budget

##### Example: verdict classification
| user output | expected | verdict |
| ----------- | -------- | ------- |
| "6\n" | "6" | AC |
| "7" | "6" | WA |
| raises ValueError | "6" | RE |
| never terminates | "6" | TLE |


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
### Requirement: Operate without cross-origin isolation
The engine SHALL run on a host page that is not cross-origin isolated and SHALL NOT depend on SharedArrayBuffer, COOP, or COEP to execute Python.

#### Scenario: Static host without special headers
- **WHEN** the engine runs on a host that sets no COOP or COEP headers
- **THEN** Python execution SHALL still succeed

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