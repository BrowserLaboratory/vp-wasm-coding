## Why

The `extract-vitepress-code-runner` change produced working, fully tested packages (core 76 / vitepress 24 / Rust 51), but they are wired for in-repo workspace use only: both `package.json` files export raw `./src/*.ts`/`.vue`, sit at version `0.0.0`, carry no `license`/`repository`/`files`/`publishConfig`, there is no build output, no CI, no release automation, and the Rust generator WASM is gitignored and never shipped. To let other projects `npm install` this as a library — the stated goal — and to push the repo to GitHub with automated npm publishing, the packages need a real build/distribution pipeline plus release automation.

## What Changes

- **BREAKING** (pre-release rename): Rename both packages to the `@cxphoenix` scope — headline `@cxphoenix/vp-wasm-coding` (currently `@vp-code-runner/vitepress`) and `@cxphoenix/vp-wasm-coding-core` (currently `@vp-code-runner/core`). Update every import specifier, the workspace dependency reference, the Vitest module mocks, and the example site imports accordingly.
- Add a build step per package that produces compiled `dist/` artifacts (ESM JavaScript + `.d.ts` type declarations + bundled CSS). Repoint `exports`/`main`/`module`/`types` at `dist`, set `files` to ship only `dist` + metadata, add `publishConfig.access:"public"`, `license: "ECL-2.0"`, `repository`, `description`, `keywords`, and a real `version` of `0.1.0`.
- Build the Rust `random-input-generator` crate with wasm-pack during the package build and bundle the resulting WASM artifact into the headline package's shipped `dist` assets, so a consumer needs only one install; default the Vite plugin's generator asset location to the bundled path while keeping it overridable.
- Add the official ECL-2.0 (Educational Community License 2.0) license text — copied verbatim from an authoritative source, not hand-written — as a `LICENSE` file at the repo root, and add a root `README.md` documenting install and usage.
- Add a GitHub Actions CI workflow that installs Rust + wasm-pack + pnpm, builds the WASM, and builds, typechecks, and tests all packages on push and pull request.
- Add Changesets-based release automation: a release workflow that builds the packages and publishes them to npm, authenticated with an `NPM_TOKEN` repository secret.

## Non-Goals

- Publishing the WASM generator as its own standalone npm package (decided: bundle it into the headline package).
- COOP/COEP headers or SharedArrayBuffer support (still deferred to a future change).
- A Monaco editor adapter (default remains CodeMirror; Monaco stays a future optional adapter).
- Client-side C/C++ compilation (separate future research track).
- One-time operator actions that cannot live in repository artifacts: creating the npm `@cxphoenix` scope, generating the `NPM_TOKEN`, and setting the GitHub Actions secret. The change prepares every file these depend on and documents the manual steps, but performing the npm publish itself and configuring secrets are operator actions outside the artifacts.

## Capabilities

### New Capabilities

- `package-distribution`: Defines what a published package SHALL contain (compiled artifacts, type declarations, bundled WASM, publish metadata, ECL-2.0 license) and how CI and release automation SHALL build, verify, and publish the packages.

### Modified Capabilities

(none)

The existing behavioral capabilities are unchanged; the compiled packages SHALL continue to satisfy them.

## Impact

- Affected specs:
  - New: `package-distribution`
- Affected code:
  - New:
    - `LICENSE`
    - `README.md`
    - `.changeset/config.json`
    - `.github/workflows/ci.yml`
    - `.github/workflows/release.yml`
    - `packages/code-runner-core/vite.config.ts`
    - `packages/vitepress-code-runner/vite.config.ts`
  - Modified:
    - `package.json`
    - `pnpm-workspace.yaml`
    - `packages/code-runner-core/package.json`
    - `packages/vitepress-code-runner/package.json`
    - `packages/vitepress-code-runner/src/composables/useCodeRunner.ts`
    - `packages/vitepress-code-runner/src/composables/useWasmGenerator.ts`
    - `packages/vitepress-code-runner/src/index.ts`
    - `packages/vitepress-code-runner/src/vite/plugin.ts`
    - `packages/vitepress-code-runner/src/config.ts`
    - `packages/vitepress-code-runner/src/components/CodeRunner.spec.ts`
    - `packages/vitepress-code-runner/src/components/CodeRunner.forged.spec.ts`
    - `packages/vitepress-code-runner/README.md`
    - `examples/vitepress-basic/package.json`
    - `examples/vitepress-basic/.vitepress/config.ts`
    - `examples/vitepress-basic/.vitepress/theme/index.ts`
    - `.gitignore`
  - Removed: (none)
