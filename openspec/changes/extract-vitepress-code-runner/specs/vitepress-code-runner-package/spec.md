## ADDED Requirements

### Requirement: SSR-safe components and composables for VitePress
The package SHALL expose components and composables that a VitePress project can register and use, and that load browser-only resources only after mount.

#### Scenario: Use the runner in a VitePress page
- **WHEN** a VitePress project registers the runner and renders it in a page
- **THEN** the page SHALL build without server-side errors and the runner SHALL become interactive in the browser

### Requirement: Configurable asset base
The package SHALL resolve the Pyodide runtime and generator WASM assets through a configurable base location and SHALL NOT require a hardcoded root-absolute path.

#### Scenario: Non-root base path
- **WHEN** the consuming site is served under a non-root base path
- **THEN** the runner SHALL resolve and load its runtime assets correctly

### Requirement: Vite plugin makes assets available in dev and build
The package SHALL provide a Vite plugin that makes the required runtime assets resolvable in both the dev server and the production build without manual copying by the consumer.

#### Scenario: Assets resolve in dev and preview
- **WHEN** the consuming site runs the dev server and the production preview
- **THEN** the runtime assets SHALL be resolvable in both modes

### Requirement: Works on a static host without special headers
The package SHALL function on a static host that sets no COOP or COEP headers.

#### Scenario: Deploy to a static host
- **WHEN** the consuming site is deployed to a static host without COOP or COEP
- **THEN** Python execution and input generation SHALL work

### Requirement: Documented security boundary
The package documentation SHALL state that the real security boundary is Worker isolation, the Content-Security-Policy connect-src restriction, and worker termination, and SHALL NOT present Python-level import blocking as a security guarantee.

#### Scenario: Security documentation
- **WHEN** a consumer reads the package security documentation
- **THEN** it SHALL describe the Worker isolation and CSP boundary and SHALL NOT claim safe execution of hostile code via import blocking
