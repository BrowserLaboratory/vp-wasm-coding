## Context

`extract-vitepress-code-runner` delivered three working, tested subsystems — `@vp-code-runner/core` (pure-TS Pyodide engine with a module Web Worker), `@vp-code-runner/vitepress` (Vue/VitePress layer with a Vite asset plugin and a pluggable CodeMirror editor), and the `random-input-generator` Rust crate (compiled to WASM via wasm-pack). They are wired for in-repo workspace use: `package.json` `exports` point at raw `./src/*.ts`/`.vue`, version is `0.0.0`, there is no build output, no publish metadata, no CI, no release automation, no root README/LICENSE, no git remote, and the WASM `pkg/` is gitignored and never shipped.

This change turns that into a publishable, automated npm library. Two architectural facts from the source constrain every decision:

1. `executor.ts` instantiates its worker with the Vite pattern `new Worker(new URL('../worker/pyodide.worker.ts', import.meta.url), { type: 'module' })`. Whatever build we use MUST emit a worker reference that a downstream Vite/VitePress build can still detect and bundle.
2. `useWasmGenerator.ts` loads the generator glue at runtime via `import(/* @vite-ignore */ glueURL())`, where `glueURL` resolves to a public asset path (`${BASE_URL}generator/...`) that the `codeRunnerAssets` Vite plugin copies into the consumer's build output. "Bundling the WASM" therefore means shipping the wasm-pack output inside the package and defaulting the plugin's generator asset directory to the in-package location — not turning it into a static ESM import.

## Goals / Non-Goals

**Goals:**

- Both packages install from npm and work in a downstream VitePress project with no manual asset wiring beyond registering the Vite plugin.
- Compiled `dist/` output (ESM + `.d.ts` + bundled CSS); `exports`/`main`/`module`/`types` point at `dist`; `files` ships only `dist` + metadata.
- The generator WASM ships inside the headline package; a single `npm install` enables `generate_challenge`.
- Publish metadata complete on both packages: `@cxphoenix` scope, version `0.1.0`, `license: "ECL-2.0"`, `repository`, `description`, `keywords`, `publishConfig.access: "public"`.
- Root `LICENSE` (official ECL-2.0 text) and root `README.md`.
- CI builds the WASM and builds/typechecks/tests all packages on push and PR.
- Changesets-based release automation publishes to npm on release using an `NPM_TOKEN` secret.
- The existing 151 tests and the existing behavioral specs continue to pass after the scope rename.

**Non-Goals:**

- Bundling Pyodide (~10 MB+) into the package — it stays consumer-supplied via the existing download script or a CDN URL.
- Publishing the WASM as a standalone npm package (decided: bundle).
- COOP/COEP / SharedArrayBuffer, a Monaco adapter, or C/C++ compilation.
- Collapsing core into a single package — core stays separately consumable for framework-agnostic reuse.
- Performing the actual npm publish, creating the npm scope, or setting CI secrets — these are one-time operator actions; this change only prepares the files and documents the steps.

## Decisions

### Vite library mode with vite-plugin-dts for both packages

Build both packages with Vite library mode (`build.lib`) plus `vite-plugin-dts` for declarations; the vitepress package additionally uses `@vitejs/plugin-vue`. Rationale: the core ships a module Web Worker and Vite has first-class worker handling, whereas esbuild/tsup require manual entry wiring and mishandle the cross-package `new URL` worker reference more often. One tool for both packages keeps the build uniform. `vue-tsc` (not currently installed) and `vite-plugin-dts` are added as devDependencies; the vitepress declarations are emitted through vue-tsc so `.vue` types resolve. Alternative considered: tsup for core, Vite for vitepress — rejected to avoid two build tools and the worker-URL risk on the esbuild side.

### Preserve the consumer-bundled Web Worker reference across the package boundary

Core's `dist` MUST retain a `new URL('./<worker>.js', import.meta.url)` form so the downstream Vite build detects and emits the worker, OR emit the worker as a sibling asset that the consumer copies. The authoritative acceptance gate is the end-to-end `examples/vitepress-basic` build + real-browser run (the same gate used for the extract change): the worker must spawn, Python must run, and AC/WA verdicts must render against the installed/linked compiled package — not the raw source. Risk and fallback are tracked under Risks.

### Bundle the random-input-generator WASM into the headline package assets

The wasm-pack `--target web` output (glue `.js`, `_bg.wasm`, `.d.ts`) is produced during the package build and placed inside the headline package's shipped assets. The `codeRunnerAssets` Vite plugin's generator source directory defaults to the in-package asset location (resolved relative to the compiled plugin module), while remaining overridable for consumers who self-host. The runtime path produced by `resolveGeneratorGlueURL` and the shipped glue filename MUST agree. Alternative considered: standalone npm package for the WASM — rejected per the naming decision (one install).

### Scope rename to @cxphoenix with two published packages

Rename `@vp-code-runner/vitepress` → `@cxphoenix/vp-wasm-coding` (headline) and `@vp-code-runner/core` → `@cxphoenix/vp-wasm-coding-core`. The headline depends on core via `workspace:*`, which pnpm rewrites to the concrete version on publish. Every import specifier, the Vitest `vi.mock('@vp-code-runner/core')` calls, and the example site imports are updated. Alternative considered: collapse both into a single package to match the single name the user gave — rejected because it would erase core's framework-agnostic reusability; the `-core` suffix preserves it while keeping one headline install. This derivation is surfaced for the user to override at apply time.

### Changesets for versioning and tag/release-triggered npm publish

Use `@changesets/cli` with `.changeset/config.json` configured for the pnpm monorepo and public access. A `release.yml` workflow runs the Changesets action: it opens/updates a version PR and, on release, builds the packages (WASM + Vite lib build) and runs `pnpm publish` authenticated by the `NPM_TOKEN` secret. Rationale: Changesets is the standard for multi-package pnpm monorepos with `workspace:*` links and handles version-range rewriting on publish. Alternative considered: semantic-release — rejected as heavier and less idiomatic for monorepos.

### GitHub Actions CI builds WASM then builds, typechecks, and tests all packages

`ci.yml` runs on push and pull_request: checkout, install Rust toolchain + wasm-pack, install pnpm + Node, `wasm-pack build` the crate, run the Rust tests, then `pnpm install` and build/typecheck/test both JS packages. Build order matters: the WASM and the Vite lib build must precede any step that consumes them. Reference layout: `temp-refs/fhsh.py-dojo/.github/workflows/release.yml`.

### ECL-2.0 license text copied from an authoritative source

The root `LICENSE` file contains the verbatim Educational Community License 2.0 text fetched from an authoritative source (e.g. opensource.org / SPDX), NOT hand-written or paraphrased. Each `package.json` sets `license: "ECL-2.0"` (the SPDX identifier). Acceptance: the LICENSE body matches the canonical ECL-2.0 text.

## Implementation Contract

**Behavior (observable once shipped):**

- A downstream project runs `npm install @cxphoenix/vp-wasm-coding`, registers the Vite plugin and the component, and gets a working code runner with `generate_challenge` available — without manually copying generator WASM.
- `npm pack --dry-run` (or the packed tarball) for each package contains only compiled `dist` artifacts (`.mjs`/`.js`, `.d.ts`, `.css`, and the bundled generator WASM for the headline package) plus `package.json`, `README.md`, and `LICENSE` — no `src`, no tests, no configs.
- Importing the package types resolves: `import { CodeRunner } from '@cxphoenix/vp-wasm-coding'` and `import { createExecutor } from '@cxphoenix/vp-wasm-coding-core'` typecheck against the shipped `.d.ts`.

**Interface / data shape:**

- Headline package `exports`: `.` (component/composables entry), `./vite` (the `codeRunnerAssets` plugin), `./editors/codemirror`, `./style.css` — all pointing at `dist`.
- Core package `exports`: `.` (engine entry) and `./worker` (the Pyodide worker) — pointing at `dist`.
- Each `exports` entry provides both `import` (ESM) and `types` (`.d.ts`) conditions.
- `codeRunnerAssets(options)` keeps its current option names; `generatorDir` becomes optional, defaulting to the in-package WASM location.

**Failure modes:**

- If the generator WASM is missing at runtime, `generateChallenge` already resolves `null` (never throws) — this behavior is preserved.
- If `NPM_TOKEN` is absent, the release workflow's publish step fails loudly in CI rather than publishing nothing silently.
- A build that breaks the downstream worker reference MUST fail the e2e acceptance gate (a non-spawning worker is a hard failure, not a degraded mode).

**Acceptance criteria:**

- The existing 151 tests (core 76, vitepress 24, Rust 51) pass after the scope rename, with `vi.mock` targets updated.
- `examples/vitepress-basic` builds against the compiled/published-shape packages and, in a real browser, runs Python (AC/WA verdicts render) and `generate_challenge` produces inputs.
- `npm pack --dry-run` for both packages shows only `dist` + metadata.
- The shipped `.d.ts` resolve for the public entry points.
- `pnpm changeset status` succeeds and the CI/release workflow YAML is valid and references the correct build order (WASM before package build).
- The root `LICENSE` matches canonical ECL-2.0 text; both `package.json` carry `license: "ECL-2.0"`, `repository`, `version: "0.1.0"`, `files`, and `publishConfig.access: "public"`.

**Scope boundaries:**

- In scope: build configs, publish metadata, scope rename, WASM bundling + plugin default, LICENSE/README, CI + release workflows, Changesets setup, `.gitignore` adjustments, updating the example site and test mocks to the new names.
- Out of scope: changing any runtime behavior of the engine, editor, or generator; bundling Pyodide; creating the npm scope; generating/setting `NPM_TOKEN`; the actual first publish.

## Risks / Trade-offs

- [Web Worker reference does not survive library compilation, breaking the worker in downstream builds] → Make the e2e example-site build the mandatory acceptance gate; if Vite lib mode rewrites the URL in a non-consumer-resolvable way, fall back to emitting the worker as an untransformed sibling asset referenced by a relative `new URL('./<worker>.js', import.meta.url)`.
- [Generator WASM path mismatch between the shipped glue filename and `resolveGeneratorGlueURL`] → Assert the runtime URL and the bundled filename agree as part of the e2e gate.
- [`vue-tsc` / `vite-plugin-dts` emit incorrect or incomplete `.vue` declarations] → Verify the public entry types resolve from a consumer TS context as an acceptance check.
- [Scope rename misses an import specifier or a `vi.mock` target, breaking tests or runtime resolution] → Rename is a discrete task gated on the full test suite passing.
- [`workspace:*` is published literally instead of a concrete range] → Use pnpm's publish (via Changesets) which rewrites `workspace:*`; verify in the packed tarball.

## Migration Plan

This is additive packaging; there is no existing published version to migrate. Sequence: rename scope and fix all references (tests green) → add build configs and produce `dist` → bundle WASM and default the plugin path → fill publish metadata → add LICENSE/README → add CI → add Changesets + release workflow → verify via e2e build and `npm pack --dry-run`. Operator follow-up (outside artifacts): create the npm `@cxphoenix` scope, add `NPM_TOKEN` to GitHub secrets, create the remote repo, push, then cut the first release via Changesets. Rollback: none needed pre-publish; before the first release nothing is public, so reverting the change fully unwinds it.

## Open Questions

- Confirm the `@cxphoenix/vp-wasm-coding` + `@cxphoenix/vp-wasm-coding-core` two-package naming (vs. a single combined package). Proceeding with two packages; correctable at apply time.
