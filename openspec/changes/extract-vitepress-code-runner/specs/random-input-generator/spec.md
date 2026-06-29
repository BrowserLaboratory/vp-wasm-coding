## ADDED Requirements

### Requirement: Generate random stdin inputs from a parameter specification
The generator SHALL accept a JSON parameter specification and a count, and SHALL return that many random standard-input strings conforming to the specification.

#### Scenario: Generate N inputs
- **WHEN** the host calls the generator with a parameter specification and count N
- **THEN** the generator SHALL return exactly N input strings, each conforming to the specification

##### Example: integer parameter within bounds
- **GIVEN** specification {"shift": {"type": "int", "min": 1, "max": 25}} and count 5
- **WHEN** the generator runs
- **THEN** it SHALL return 5 strings, each a single integer in the inclusive range 1 to 25

### Requirement: Decoupled from the encrypted pool and judge logic
The generator module SHALL NOT depend on the encrypted testcase-pool, decryption, or judge code, and its compiled artifact SHALL NOT include the AES-GCM cryptography dependency.

#### Scenario: Generator artifact excludes crypto
- **WHEN** the generator crate is compiled to WASM
- **THEN** the artifact SHALL provide input generation without linking the encrypted-pool or AES-GCM code

### Requirement: Report generation failures explicitly
The generator SHALL return a recognizable error when the parameter specification is invalid, and SHALL NOT fail silently.

#### Scenario: Invalid specification
- **WHEN** the host passes a malformed parameter specification
- **THEN** the generator SHALL surface an error that the host can detect and display
