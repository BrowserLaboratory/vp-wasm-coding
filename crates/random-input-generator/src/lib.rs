mod parser;
mod rng;

use rand::Rng;
use rand::SeedableRng;
use rand::rngs::SmallRng;
use serde::Serialize;
use wasm_bindgen::prelude::*;

/// Upper bound on the number of testcase inputs per call. Keeps a huge `count`
/// from the JS side from multiplying into unbounded allocation (each input can
/// legally reach `MAX_COUNT` values of up to `MAX_LEN` chars).
const MAX_TESTCASES: usize = 10_000;

/// Output of `generate_challenge`: a list of random stdin input strings,
/// one per testcase. The frontend feeds each to the Python generator to
/// produce the corresponding expected output.
#[derive(Serialize)]
struct GeneratedInputs {
    inputs: Vec<String>,
}

/// Native entry point: parse a JSON params specification and generate `count`
/// stdin input strings with a caller-provided RNG.
///
/// This is the only supported way to drive the generator outside WASM
/// (integration tests, future native hosts). The parse → generate pipeline is
/// inseparable by design: every spec that reaches sampling has passed
/// construction-time validation, so generation cannot panic.
pub fn generate(
    params_json: &str,
    count: usize,
    rng: &mut impl Rng,
) -> Result<Vec<String>, String> {
    if count > MAX_TESTCASES {
        return Err(format!("count ({count}) exceeds limit {MAX_TESTCASES}"));
    }
    let params = parser::parse_params(params_json)?;
    Ok((0..count).map(|_| rng::generate_input(&params, rng)).collect())
}

/// Generate random input strings from a JSON params specification.
///
/// # Arguments
/// * `params_json` — JSON object mapping param names to ParamSpec objects,
///   in the order they should appear as stdin lines.
/// * `count` — number of testcase inputs to generate.
///
/// # Returns
/// `{ inputs: [string, ...] }` — one input string per testcase.
#[wasm_bindgen]
pub fn generate_challenge(params_json: &str, count: usize) -> Result<JsValue, JsError> {
    let mut rng = SmallRng::from_entropy();
    let inputs = generate(params_json, count, &mut rng).map_err(|e| JsError::new(&e))?;
    let result = GeneratedInputs { inputs };
    serde_wasm_bindgen::to_value(&result).map_err(|e| JsError::new(&e.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generate_returns_correct_count() {
        let json = r#"{"shift": {"type": "int", "min": 1, "max": 25}}"#;
        let mut rng = SmallRng::seed_from_u64(42);
        let inputs = generate(json, 5, &mut rng).unwrap();
        assert_eq!(inputs.len(), 5);
        for input in &inputs {
            let v: i64 = input.parse().unwrap();
            assert!((1..=25).contains(&v));
        }
    }

    #[test]
    fn generate_invalid_params_json_errors() {
        let mut rng = SmallRng::seed_from_u64(42);
        assert!(generate("not json", 1, &mut rng).is_err());
    }

    #[test]
    fn generate_count_over_limit_errors() {
        let json = r#"{"shift": {"type": "int", "min": 1, "max": 25}}"#;
        let mut rng = SmallRng::seed_from_u64(42);
        let err = generate(json, MAX_TESTCASES + 1, &mut rng).unwrap_err();
        assert!(err.contains("exceeds limit"), "got: {err}");
    }

    #[test]
    fn generate_count_at_limit_is_ok() {
        let json = r#"{"shift": {"type": "int", "min": 1, "max": 25}}"#;
        let mut rng = SmallRng::seed_from_u64(42);
        assert_eq!(generate(json, MAX_TESTCASES, &mut rng).unwrap().len(), MAX_TESTCASES);
    }
}
