## ADDED Requirements

### Requirement: Packages publish compiled distribution artifacts

Each published package SHALL expose compiled distribution artifacts as its entry points and SHALL NOT ship raw source as its public entry. The compiled output SHALL include ECMAScript modules, TypeScript declaration files, and, for packages that carry styles, bundled CSS. The `exports`, `main`, `module`, and `types` fields SHALL resolve to the compiled `dist` output, and each `exports` entry SHALL provide both an `import` (ESM) condition and a `types` (declaration) condition.

#### Scenario: Consumer imports the compiled entry and its types

- **WHEN** a downstream TypeScript project imports `CodeRunner` from the headline package or `createExecutor` from the core package
- **THEN** the import SHALL resolve to compiled JavaScript and the corresponding `.d.ts`, and SHALL typecheck without referencing the package source tree

#### Scenario: Worker survives the package boundary

- **WHEN** a downstream VitePress/Vite project builds against the compiled core package and runs it in a browser
- **THEN** the Pyodide module Worker SHALL spawn, Python SHALL execute, and AC/WA verdicts SHALL render — proving the worker reference survived compilation

### Requirement: Published package contents are limited to distribution artifacts and metadata

Each package SHALL declare `files` so that the published tarball contains only the compiled `dist` output plus `package.json`, `README.md`, and `LICENSE`. The tarball SHALL NOT contain the `src` source tree, test files, or build configuration.

#### Scenario: Packed tarball excludes source and tests

- **WHEN** `npm pack --dry-run` is run for either package
- **THEN** the listed files SHALL contain only `dist` artifacts and the package metadata files, and SHALL NOT contain `src`, `*.spec.*`, or build config files

### Requirement: The generator WASM ships inside the headline package

The headline package SHALL bundle the wasm-pack output of the `random-input-generator` crate (the glue module, the `_bg.wasm` binary, and its declarations) inside its published assets, so that a single install enables `generate_challenge`. The Vite asset plugin SHALL default its generator asset source to the in-package WASM location while keeping that source overridable. The runtime glue URL resolved by the package and the shipped glue filename SHALL agree.

#### Scenario: One install enables input generation

- **WHEN** a downstream project installs only the headline package, registers the Vite plugin without specifying a generator directory, and triggers input generation in a browser
- **THEN** the bundled generator WASM SHALL load and `generate_challenge` SHALL return generated inputs

### Requirement: Packages declare complete publish metadata under the @cxphoenix scope

Both packages SHALL be named under the `@cxphoenix` scope (`@cxphoenix/vp-wasm-coding` and `@cxphoenix/vp-wasm-coding-core`) and SHALL declare a concrete `version`, `license` set to the SPDX identifier `ECL-2.0`, `repository`, `description`, `keywords`, and `publishConfig.access` set to `"public"`. The repository root SHALL contain a `LICENSE` file whose body is the verbatim Educational Community License 2.0 text from an authoritative source, and a `README.md` documenting install and usage.

#### Scenario: Metadata is publish-ready

- **WHEN** the package metadata is inspected before publishing
- **THEN** each `package.json` SHALL carry the `@cxphoenix`-scoped name, a non-`0.0.0` version, `license: "ECL-2.0"`, `repository`, and `publishConfig.access: "public"`, and the root `LICENSE` SHALL match the canonical ECL-2.0 text

### Requirement: Continuous integration builds and verifies all packages

The repository SHALL provide a GitHub Actions workflow that, on push and on pull request, installs the Rust toolchain and wasm-pack, builds the generator WASM, and then builds, typechecks, and tests both JavaScript packages. The workflow SHALL build the WASM before any step that consumes it.

#### Scenario: CI runs on a pull request

- **WHEN** a pull request is opened against the repository
- **THEN** the CI workflow SHALL build the WASM, build and typecheck both packages, and run the full test suite, failing if any step fails

### Requirement: Release automation publishes to npm

The repository SHALL provide Changesets-based release automation: a `.changeset` configuration for the pnpm monorepo with public access, and a release workflow that builds the packages and publishes them to npm authenticated by an `NPM_TOKEN` secret. The publish SHALL rewrite the `workspace:*` dependency on the core package to a concrete version range. If `NPM_TOKEN` is absent, the publish step SHALL fail loudly rather than silently skip.

#### Scenario: Release publishes both packages

- **WHEN** a release is triggered with `NPM_TOKEN` configured
- **THEN** the workflow SHALL build the WASM and the packages and publish both to npm, with the headline package depending on a concrete version of the core package rather than `workspace:*`

#### Scenario: Missing token fails loudly

- **WHEN** the release workflow's publish step runs without `NPM_TOKEN`
- **THEN** the step SHALL fail with an authentication error rather than complete without publishing
