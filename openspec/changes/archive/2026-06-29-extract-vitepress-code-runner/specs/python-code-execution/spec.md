## ADDED Requirements

### Requirement: Execute Python in an isolated worker
The engine SHALL load a Pyodide runtime inside a dedicated module Web Worker and execute user-supplied Python there, isolated from the host page's DOM and main thread.

#### Scenario: Run user code in a worker
- **WHEN** the host requests execution of a Python snippet
- **THEN** the engine SHALL run it inside a Web Worker and return the program's standard output to the host

### Requirement: Enforce a hard time limit by terminating the worker
The engine SHALL enforce a configurable wall-clock budget per run and, when the budget is exceeded, SHALL terminate the worker and report a TLE verdict. Worker termination SHALL be the authoritative time-limit guarantee.

#### Scenario: Code exceeds the time budget
- **WHEN** executed user code does not finish within the configured wall-clock budget
- **THEN** the engine SHALL terminate the worker and report the affected testcase as TLE

### Requirement: Capture standard input and output
The engine SHALL supply a provided input string as the program's standard input and SHALL capture everything written to standard output for verdict comparison.

#### Scenario: Program reads input and writes output
- **WHEN** user code reads from standard input and prints a result
- **THEN** the engine SHALL feed the supplied input and return the captured standard output

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

### Requirement: Operate without cross-origin isolation
The engine SHALL run on a host page that is not cross-origin isolated and SHALL NOT depend on SharedArrayBuffer, COOP, or COEP to execute Python.

#### Scenario: Static host without special headers
- **WHEN** the engine runs on a host that sets no COOP or COEP headers
- **THEN** Python execution SHALL still succeed
