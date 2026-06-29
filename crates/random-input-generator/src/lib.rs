mod parser;
mod rng;

use rand::SeedableRng;
use rand::rngs::SmallRng;
use serde::Serialize;
use wasm_bindgen::prelude::*;

/// Output of `generate_challenge`: a list of random stdin input strings,
/// one per testcase. The frontend feeds each to the Python generator to
/// produce the corresponding expected output.
#[derive(Serialize)]
struct GeneratedInputs {
    inputs: Vec<String>,
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
    let params = parser::parse_params(params_json).map_err(|e| JsError::new(&e))?;
    let mut rng = SmallRng::from_entropy();
    let inputs: Vec<String> = (0..count)
        .map(|_| rng::generate_input(&params, &mut rng))
        .collect();
    let result = GeneratedInputs { inputs };
    serde_wasm_bindgen::to_value(&result).map_err(|e| JsError::new(&e.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generate_challenge_returns_correct_count() {
        let json = r#"{"shift": {"type": "int", "min": 1, "max": 25}}"#;
        let params = parser::parse_params(json).unwrap();
        let mut rng = SmallRng::seed_from_u64(42);
        let inputs: Vec<String> = (0..5)
            .map(|_| rng::generate_input(&params, &mut rng))
            .collect();
        assert_eq!(inputs.len(), 5);
        for input in &inputs {
            let v: i64 = input.parse().unwrap();
            assert!((1..=25).contains(&v));
        }
    }

    #[test]
    fn generate_challenge_invalid_params_json() {
        let result = parser::parse_params("not json");
        assert!(result.is_err());
    }
}
