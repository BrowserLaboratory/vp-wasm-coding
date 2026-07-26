# random-input-generator

Rust→WASM random stdin generator for `vp-wasm-coding`. The public entry point
`generate_challenge(params_json, count)` takes a JSON *params* object — an
ordered map of `name → parameter spec`, one output line per parameter — and
returns `count` random stdin strings.

```json
{
  "plaintext": { "type": "alpha_upper", "min_len": 5, "max_len": 12 },
  "shift":     { "type": "int", "min": 1, "max": 25 }
}
```

## Parameter spec

### Common fields (all types)

| Field | Default | Meaning |
| ----- | ------- | ------- |
| `count.min` / `count.max` | `1` / `1` | The actual number of values `n` is drawn uniformly from `[count.min, count.max]`. Omitting `count` entirely is equivalent to `{"min": 1, "max": 1, "separator": " "}`. |
| `count.separator` | `" "` | Separator joined between tokens on the line. |
| `distinct` | `false` | Values within the line are pairwise distinct (see below). |
| `prefix_count` | `false` | The line starts with the actual count `n` (see below). |

`count.max` is capped at `10_000`; string lengths at `100_000`; the testcase
`count` argument of `generate_challenge` at `10_000`. All validation runs at
construction time (`parse_params`) and is active in **release builds** —
invalid specs return a descriptive error, they never panic downstream.

**Unknown keys are rejected.** A misspelled field (`"distnct"`,
`"prefix-count"`, `count.seperator`) is a construction-time error, not a
silently ignored key — a typo'd opt-in flag must never silently disable the
guarantee it was meant to enable.

**Separators are the author's responsibility.** `count.separator` is joined
verbatim and not validated: an empty string, a digit, a newline, or a character
that can occur inside the values themselves (e.g. `,` with `printable_ascii`,
or an `enum` whose `values` contain the separator) produces output that may be
ambiguous to re-split or span multiple lines. Choose a separator that cannot
collide with your value alphabet.

### Types

| `type` | Fields (defaults) |
| ------ | ----------------- |
| `int` | `min` (0), `max` (100) — 64-bit signed |
| `alpha_upper`, `alpha_lower`, `alpha_mixed`, `hex_string`, `printable_ascii` | `min_len` (1), `max_len` (255), `multiple_of` (1) |
| `enum` | `values` — non-empty string array (required) |
| `faker` (feature-gated) | `category` — `name`, `first_name`, `last_name`, `email`, `company`, `city`, `country` |

## `distinct: true` — pairwise-distinct values

All values generated for the parameter within one line (one `count` batch) are
pairwise distinct. Distinctness across different parameters is not guaranteed.

Per-type support:

| Type | Support | Domain size |
| ---- | ------- | ----------- |
| `int` | supported | `max − min + 1` (computed overflow-safe; the full i64 range is fine) |
| `enum` | supported | number of **deduplicated** `values` |
| string types | **rejected** — construction-time error | — |
| `faker` | **rejected** — construction-time error | — |

Construction-time validation (in order):

1. Basic bounds — `min ≤ max`, `count.min ≤ count.max` — always active,
   regardless of `distinct`.
2. Domain size ≥ `count.max`, otherwise a construction-time error. The
   generator never silently emits duplicates and never loops forever.

Behavioral guarantees:

- When the domain size equals `count.max` (the tight case), the output is a
  random permutation of the domain.
- The output order is random — never a fixed sorted order (sorted output would
  leak problem structure, e.g. "k-th smallest" tasks).

## `prefix_count: true` — APCS-style count prefix

The actual count `n` and the `n` values form **one token sequence** joined by
`count.separator` (join semantics — the separator only appears between tokens):

```text
count: {min: 5, max: 8}, prefix_count: true   →   6 x1 x2 x3 x4 x5 x6
separator ","                                  →   3,x1,x2,x3
```

- `n` is the *actual* drawn count, not `count.max`.
- Applies to **all** types (it only concerns the count, not the values).
- `n = 0` (possible when `count.min` is 0): the line is exactly `0` — no
  separator, no values. Without `prefix_count`, `n = 0` stays an empty line.
- `count` omitted: the line is `1<sep>value`.
- Combining with `distinct` is allowed, but `prefix_count` does **not** relax
  the `distinct` type rules — `distinct` on a string type is an error with or
  without `prefix_count`.

Both fields default to `false`; specs that don't declare them behave exactly as
before they existed.

## Example (APCS-style line, distinct values)

```json
{
  "numbers": {
    "type": "int", "min": 1, "max": 1000000,
    "count": { "min": 5, "max": 20, "separator": " " },
    "distinct": true, "prefix_count": true
  }
}
```

Possible output line: `7 42 981 5 100003 77 6 314159`

## Testing

- `cargo test` — unit tests plus the conformance harness
  (`tests/conformance.rs`), which runs the language-neutral JSON fixtures in
  `tests/fixtures/` covering the requirement's traceability matrix M1–M22.
- `cargo test --release` — mandatory in CI: proves the error-path validation
  survives release builds (no `debug_assert!`-only checks) and runs the Q3
  performance tests.
- `tests/quality.rs` — fixed-seed statistical smoke tests: Q1 output-order
  (no systematic sorting), Q2 chi-squared uniformity, Q3 performance
  (single line under 100 ms for `n = 10^4` from `[1, 10^9]`, and for a full
  `[1, 10^4]` permutation). Performance reference environment: **native
  release build** (not WASM).
