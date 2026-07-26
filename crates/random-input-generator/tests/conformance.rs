//! Conformance harness: data-driven fixtures shared across implementations.
//!
//! Each fixture in `tests/fixtures/*.json` is one acceptance unit from the
//! requirement's traceability matrix (M1–M22): a `params` spec plus a
//! declarative `expect` block. The params and expectations are language-neutral
//! data so a future second implementation only needs to rewrite this thin
//! harness, not the fixtures.
//!
//! Fixture shape:
//! ```json
//! {
//!   "description": "M1: distinct int basic",
//!   "params": { "<name>": { ...ParamSpec... } },   // exactly one param
//!   "iterations": 100,                              // optional, default 50
//!   "expect": {
//!     "error": true,                    // construction must fail...
//!     "error_contains": "distinct",     // ...with this substring (optional)
//!     "line": {                         // or: checks on the generated line
//!       "separator": " ",               // token separator (default " ")
//!       "prefix_count": true,           // first token == number of following tokens
//!       "distinct": true,               // value tokens pairwise distinct
//!       "count_range": [5, 20],         // number of value tokens (prefix excluded)
//!       "int_range": [1, 1000000],      // every value token parses into this range
//!       "values_in": ["r", "g"],        // every value token is from this set
//!       "permutation_of": ["1", "2"],   // value tokens are exactly this multiset
//!       "exact": "0"                    // the whole line equals this string
//!     }
//!   }
//! }
//! ```

use rand::SeedableRng;
use rand::rngs::SmallRng;
use random_input_generator::generate;
use serde_json::Value;
use std::path::{Path, PathBuf};

const DEFAULT_ITERATIONS: u64 = 50;
/// Self-held fixture seed base (Part II contract: each implementation picks and
/// records its own seeds). Changing it is a reviewed test change.
const SEED_BASE: u64 = 0x5EED_BA5E;

fn fixture_paths() -> Vec<PathBuf> {
    let dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures");
    let mut paths: Vec<PathBuf> = std::fs::read_dir(&dir)
        .expect("tests/fixtures directory must exist")
        .map(|e| e.expect("readable dir entry").path())
        .filter(|p| p.extension().is_some_and(|e| e == "json"))
        .collect();
    paths.sort();
    paths
}

#[test]
fn conformance_fixtures() {
    let paths = fixture_paths();
    assert!(!paths.is_empty(), "no fixtures found in tests/fixtures");
    println!("loaded {} conformance fixtures", paths.len());
    for path in &paths {
        let name = path.file_name().unwrap().to_string_lossy().to_string();
        run_fixture(&name, path);
    }
}

fn run_fixture(name: &str, path: &Path) {
    let raw = std::fs::read_to_string(path)
        .unwrap_or_else(|e| panic!("{name}: cannot read fixture: {e}"));
    let fixture: Value = serde_json::from_str(&raw)
        .unwrap_or_else(|e| panic!("{name}: fixture is not valid JSON: {e}"));

    let params_value = fixture
        .get("params")
        .unwrap_or_else(|| panic!("{name}: fixture missing `params`"));
    let params_obj = params_value
        .as_object()
        .unwrap_or_else(|| panic!("{name}: `params` must be an object"));
    assert_eq!(
        params_obj.len(),
        1,
        "{name}: harness supports exactly one param per fixture"
    );
    let params_json = serde_json::to_string(params_value).unwrap();
    let expect = fixture
        .get("expect")
        .unwrap_or_else(|| panic!("{name}: fixture missing `expect`"));

    // ── construction-time error expectations ────────────────────────────────
    if expect.get("error").and_then(Value::as_bool) == Some(true) {
        let mut rng = SmallRng::seed_from_u64(SEED_BASE);
        let err = match generate(&params_json, 1, &mut rng) {
            Err(e) => e,
            Ok(_) => panic!("{name}: expected a construction-time error, but parsing succeeded"),
        };
        if let Some(substr) = expect.get("error_contains").and_then(Value::as_str) {
            assert!(
                err.contains(substr),
                "{name}: error should contain '{substr}', got: {err}"
            );
        }
        return;
    }

    // ── generated-line expectations ─────────────────────────────────────────
    let line_checks = expect
        .get("line")
        .unwrap_or_else(|| panic!("{name}: expect needs `error` or `line`"));
    let iterations = fixture
        .get("iterations")
        .and_then(Value::as_u64)
        .unwrap_or(DEFAULT_ITERATIONS);

    for i in 0..iterations {
        let mut rng = SmallRng::seed_from_u64(SEED_BASE + i);
        let lines = generate(&params_json, 1, &mut rng)
            .unwrap_or_else(|e| panic!("{name}: unexpected parse error: {e}"));
        check_line(name, i, &lines[0], line_checks);
    }
}

fn check_line(name: &str, iteration: u64, line: &str, checks: &Value) {
    let ctx = format!("{name} (iteration {iteration}, line: {line:?})");

    if let Some(exact) = checks.get("exact").and_then(Value::as_str) {
        assert_eq!(line, exact, "{ctx}: exact mismatch");
        return;
    }

    let separator = checks
        .get("separator")
        .and_then(Value::as_str)
        .unwrap_or(" ");
    let all_tokens: Vec<&str> = if line.is_empty() {
        Vec::new()
    } else {
        line.split(separator).collect()
    };

    // prefix_count: first token declares how many value tokens follow.
    let value_tokens: &[&str] = if checks.get("prefix_count").and_then(Value::as_bool) == Some(true)
    {
        let prefix = all_tokens
            .first()
            .unwrap_or_else(|| panic!("{ctx}: expected a prefix token"));
        let n: usize = prefix
            .parse()
            .unwrap_or_else(|_| panic!("{ctx}: prefix token '{prefix}' is not a count"));
        assert_eq!(
            all_tokens.len(),
            n + 1,
            "{ctx}: prefix {n} must equal the number of following value tokens"
        );
        &all_tokens[1..]
    } else {
        &all_tokens[..]
    };

    if let Some(range) = checks.get("count_range") {
        let lo = range[0].as_u64().unwrap() as usize;
        let hi = range[1].as_u64().unwrap() as usize;
        assert!(
            (lo..=hi).contains(&value_tokens.len()),
            "{ctx}: value token count {} outside [{lo}, {hi}]",
            value_tokens.len()
        );
    }

    if checks.get("distinct").and_then(Value::as_bool) == Some(true) {
        let unique: std::collections::HashSet<_> = value_tokens.iter().collect();
        assert_eq!(
            unique.len(),
            value_tokens.len(),
            "{ctx}: value tokens must be pairwise distinct"
        );
    }

    if let Some(range) = checks.get("int_range") {
        let lo = range[0].as_i64().unwrap();
        let hi = range[1].as_i64().unwrap();
        for t in value_tokens {
            let v: i64 = t
                .parse()
                .unwrap_or_else(|_| panic!("{ctx}: token '{t}' is not an integer"));
            assert!(
                (lo..=hi).contains(&v),
                "{ctx}: value {v} outside [{lo}, {hi}]"
            );
        }
    }

    if let Some(allowed) = checks.get("values_in").and_then(Value::as_array) {
        let set: std::collections::HashSet<&str> =
            allowed.iter().filter_map(Value::as_str).collect();
        for t in value_tokens {
            assert!(set.contains(t), "{ctx}: token '{t}' not in allowed set");
        }
    }

    if let Some(expected) = checks.get("permutation_of").and_then(Value::as_array) {
        let mut expected: Vec<&str> = expected.iter().filter_map(Value::as_str).collect();
        let mut actual: Vec<&str> = value_tokens.to_vec();
        expected.sort_unstable();
        actual.sort_unstable();
        assert_eq!(actual, expected, "{ctx}: tokens are not the expected permutation");
    }
}
