## ADDED Requirements

### Requirement: Language-agnostic editor adapter contract
The library SHALL define an editor adapter contract that exposes the code as a two-way bound string value and accepts a language identifier and a read-only flag, independent of any specific editor implementation.

#### Scenario: Adapter exposes code via two-way binding
- **WHEN** the host binds a value to an editor adapter and the user edits the code
- **THEN** the adapter SHALL update the bound value, and external updates to the bound value SHALL update the editor content

### Requirement: Default CodeMirror adapter
The library SHALL provide a default CodeMirror adapter whose behavior is equivalent to the source editor, including lazy loading, a loading placeholder, and Python autocompletion.

#### Scenario: Default editor renders and edits Python
- **WHEN** a host uses the runner without specifying an editor
- **THEN** the CodeMirror adapter SHALL load, display Python code with autocompletion, and report edits through the adapter contract

### Requirement: Host can replace the editor implementation
The runner UI SHALL accept an injected editor component conforming to the adapter contract and SHALL use it in place of the default.

#### Scenario: Inject an alternative editor
- **WHEN** a host injects a custom editor component that conforms to the adapter contract
- **THEN** the runner SHALL use the injected editor and still read and update the code through the contract

### Requirement: Editor renders client-only
Editor implementations SHALL load only in the browser after mount and SHALL NOT execute during server-side rendering.

#### Scenario: Build under SSR
- **WHEN** the consuming VitePress site is built with SSR or SSG
- **THEN** the editor SHALL NOT access browser-only APIs during the server build
