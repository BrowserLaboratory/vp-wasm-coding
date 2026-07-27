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

---
### Requirement: Distinct values within a line
The generator SHALL accept an optional boolean field `distinct` at the top level of a parameter specification (sibling of `type` and `count`), defaulting to `false`. When `distinct` is `true`, all values generated for that parameter within a single line (one `count` batch) SHALL be pairwise distinct. Distinctness across different parameters is NOT guaranteed. Support is per-type: `int` and `enum` SHALL be supported; string types (`alpha_upper`, `alpha_lower`, `alpha_mixed`, `hex_string`, `printable_ascii`) and `faker` SHALL be rejected with a construction-time error when `distinct: true` is declared. For `enum`, the value domain SHALL be the deduplicated `values` list. The output order of the distinct values SHALL NOT be a fixed sorted order imposed by the implementation.

#### Scenario: Distinct integers within one line
- **WHEN** a parameter is `{"type": "int", "min": 1, "max": 1000000, "count": {"min": 5, "max": 20}, "distinct": true}` and a line is generated
- **THEN** the line SHALL contain between 5 and 20 values, each in [1, 1000000], all pairwise distinct

#### Scenario: Tight domain produces a permutation
- **WHEN** a parameter is `{"type": "int", "min": 1, "max": 5, "count": {"min": 5, "max": 5}, "distinct": true}` and a line is generated
- **THEN** the line SHALL be a random permutation of the domain {1, 2, 3, 4, 5}

##### Example: permutation of a tight domain
- **GIVEN** `{"type": "int", "min": 1, "max": 5, "count": {"min": 5, "max": 5}, "distinct": true}`
- **WHEN** one line is generated
- **THEN** the line contains exactly the values 1, 2, 3, 4, 5 in an order chosen at random (e.g. `3 1 5 2 4`)

#### Scenario: Distinct enum values
- **WHEN** a parameter is `{"type": "enum", "values": ["red", "green", "blue", "red"], "count": {"min": 3, "max": 3}, "distinct": true}` and a line is generated
- **THEN** the line SHALL be a random permutation of the deduplicated values {red, green, blue}

#### Scenario: Distinct declared on an unsupported type
- **WHEN** a parameter of a string type or `faker` type declares `distinct: true`
- **THEN** parsing SHALL fail with a construction-time error naming the parameter; the generator SHALL NOT silently ignore the field


<!-- @trace
source: add-distinct-prefix-count
updated: 2026-07-27
code:
  - .understand-anything/knowledge-graph.json
  - skills-lock.json
  - .understand-anything/intermediate/scan-result.json
  - .understand-anything/config.json
  - .agents/skills/grilling/SKILL.md
  - .agents/skills/grilling/agents/openai.yaml
  - .understand-anything/meta.json
  - .understand-anything/.understandignore
  - .understand-anything/fingerprints.json
-->

---
### Requirement: Prefix count line format
The generator SHALL accept an optional boolean field `prefix_count` at the top level of a parameter specification, defaulting to `false`. When `prefix_count` is `true`, the line SHALL be the token sequence consisting of the actual generated count `n` followed by the `n` generated values, joined by `count.separator` (join semantics: the separator appears only between tokens). `n` SHALL be the actual number of values drawn from [count.min, count.max], not `count.max`. `prefix_count` SHALL apply to all parameter types. When `n = 0`, the line SHALL be exactly `0` with no trailing separator and no values. `prefix_count` SHALL NOT relax the per-type support rules of `distinct`.

#### Scenario: Prefix count with default separator
- **WHEN** a parameter is `{"type": "int", "min": 1, "max": 100, "count": {"min": 3, "max": 3}, "prefix_count": true}` and a line is generated
- **THEN** the line SHALL have the form `3 x1 x2 x3` where each xi is in [1, 100]

#### Scenario: Prefix count with custom separator
- **WHEN** the parameter declares `count: {"min": 2, "max": 2, "separator": ","}` and `prefix_count: true`
- **THEN** the line SHALL have the form `2,x1,x2`

#### Scenario: Prefix count when zero values are drawn
- **WHEN** `count.min` is 0, the drawn count is 0, and `prefix_count` is `true`
- **THEN** the line SHALL be exactly `0`

#### Scenario: Zero values without prefix count
- **WHEN** `count.min` is 0, the drawn count is 0, and `prefix_count` is `false` or omitted
- **THEN** the line SHALL be an empty line (existing behavior)

#### Scenario: Prefix count with count omitted
- **WHEN** a parameter declares `prefix_count: true` and omits `count` entirely
- **THEN** the line SHALL have the form `1 value` because omitting `count` is equivalent to `{"min": 1, "max": 1, "separator": " "}`

#### Scenario: Combined distinct and prefix count
- **WHEN** a parameter declares both `distinct: true` and `prefix_count: true` on a supported type
- **THEN** the line SHALL satisfy both the distinct requirement and the prefix count format

##### Example: APCS-style line
- **GIVEN** `{"type": "int", "min": 1, "max": 1000000, "count": {"min": 5, "max": 8}, "distinct": true, "prefix_count": true}`
- **WHEN** one line is generated and 6 values are drawn
- **THEN** the line has the form `6 x1 x2 x3 x4 x5 x6` with all xi pairwise distinct and in range


<!-- @trace
source: add-distinct-prefix-count
updated: 2026-07-27
code:
  - .understand-anything/knowledge-graph.json
  - skills-lock.json
  - .understand-anything/intermediate/scan-result.json
  - .understand-anything/config.json
  - .agents/skills/grilling/SKILL.md
  - .agents/skills/grilling/agents/openai.yaml
  - .understand-anything/meta.json
  - .understand-anything/.understandignore
  - .understand-anything/fingerprints.json
-->

---
### Requirement: Construction-time validation for distinct feasibility
When `distinct` is `true`, the generator SHALL validate at construction time (after parsing, before any sampling) that the domain size is greater than or equal to `count.max`, computing the domain size with overflow-safe arithmetic (saturating or widened). For `int` the domain size is `max - min + 1`; for `enum` it is the number of deduplicated `values`. On failure the generator SHALL return a descriptive error; it SHALL NOT silently produce duplicate values and SHALL NOT loop indefinitely. Basic bounds validation (`min <= max`, `count.min <= count.max`) SHALL remain in effect regardless of `distinct`, and all construction-time validation SHALL be active in release/production builds, not only in debug builds.

#### Scenario: Domain smaller than requested count
- **WHEN** a parameter is `{"type": "int", "min": 1, "max": 3, "count": {"min": 5, "max": 5}, "distinct": true}`
- **THEN** parsing SHALL fail with a construction-time error describing the insufficient domain

#### Scenario: Enum domain smaller than requested count
- **WHEN** a parameter is `{"type": "enum", "values": ["a", "b", "a"], "count": {"min": 3, "max": 3}, "distinct": true}`
- **THEN** parsing SHALL fail because the deduplicated domain size 2 is less than `count.max` 3

#### Scenario: Overflow-safe domain size computation
- **WHEN** a parameter declares `distinct: true` with `min` and `max` spanning the full 64-bit signed integer range
- **THEN** the domain size computation SHALL NOT overflow and validation SHALL succeed for any `count.max` within limits

#### Scenario: Validation active in release builds
- **WHEN** the error-path cases in this specification are executed against a release/production build of the crate
- **THEN** each case SHALL fail with the same construction-time error behavior as in debug builds


<!-- @trace
source: add-distinct-prefix-count
updated: 2026-07-27
code:
  - .understand-anything/knowledge-graph.json
  - skills-lock.json
  - .understand-anything/intermediate/scan-result.json
  - .understand-anything/config.json
  - .agents/skills/grilling/SKILL.md
  - .agents/skills/grilling/agents/openai.yaml
  - .understand-anything/meta.json
  - .understand-anything/.understandignore
  - .understand-anything/fingerprints.json
-->

---
### Requirement: Backward compatibility of new fields
Parameter specifications that do not declare `distinct` or `prefix_count` SHALL produce output with semantics identical to the current behavior, and omitting either field SHALL be equivalent to declaring it as `false`.

#### Scenario: Existing specifications unchanged
- **WHEN** an existing parameter specification without `distinct` or `prefix_count` is parsed and generated
- **THEN** the output semantics SHALL be identical to the behavior before this change


<!-- @trace
source: add-distinct-prefix-count
updated: 2026-07-27
code:
  - .understand-anything/knowledge-graph.json
  - skills-lock.json
  - .understand-anything/intermediate/scan-result.json
  - .understand-anything/config.json
  - .agents/skills/grilling/SKILL.md
  - .agents/skills/grilling/agents/openai.yaml
  - .understand-anything/meta.json
  - .understand-anything/.understandignore
  - .understand-anything/fingerprints.json
-->

---
### Requirement: Unknown parameter fields are rejected
The generator SHALL reject, at construction time, any parameter specification containing a field name it does not recognise — at the parameter level and inside `count` — so that a misspelled opt-in field (such as `distinct` or `prefix_count`) fails loudly instead of silently defaulting to `false` and disabling the guarantee it was meant to enable. This is an intentional tightening recorded under the narrow reading of backward compatibility: specifications conforming to the documented schema are unaffected.

#### Scenario: Misspelled distinct field
- **WHEN** a parameter declares `"distnct": true` (misspelled)
- **THEN** parsing SHALL fail with an error identifying the unknown field

#### Scenario: Misspelled field nested in count
- **WHEN** a parameter declares `count` containing `"seperator"` (misspelled)
- **THEN** parsing SHALL fail with an error identifying the unknown field

<!-- @trace
source: add-distinct-prefix-count
updated: 2026-07-27
code:
  - .understand-anything/knowledge-graph.json
  - skills-lock.json
  - .understand-anything/intermediate/scan-result.json
  - .understand-anything/config.json
  - .agents/skills/grilling/SKILL.md
  - .agents/skills/grilling/agents/openai.yaml
  - .understand-anything/meta.json
  - .understand-anything/.understandignore
  - .understand-anything/fingerprints.json
-->