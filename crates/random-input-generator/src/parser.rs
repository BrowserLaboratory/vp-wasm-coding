use indexmap::IndexMap;
use serde::Deserialize;

// Define default values if not passing in.
fn default_min_len() -> usize { 1 }
fn default_max_len() -> usize { 255 }
fn default_min_int() -> i64 { 0 }
fn default_max_int() -> i64 { 100 }
fn default_multiple_of() -> usize { 1 }
fn default_count_min() -> usize { 1 }
fn default_count_max() -> usize { 1 }
fn default_separator() -> String { " ".to_string() }

/// Count specification: how many values to generate and how to join them.
///
/// Serialised in JSON as an object, e.g.:
/// ```json
/// {"min": 2, "max": 5, "separator": ","}
/// ```
/// All fields are optional; omitting the whole `count` key uses the defaults.
#[derive(Debug, Deserialize, Clone, PartialEq)]
pub struct CountSpec {
    #[serde(default = "default_count_min")]
    pub min: usize,
    #[serde(default = "default_count_max")]
    pub max: usize,
    #[serde(default = "default_separator")]
    pub separator: String,
}

impl Default for CountSpec {
    fn default() -> Self {
        CountSpec { min: 1, max: 1, separator: " ".to_string() }
    }
}

/// Supported parameter types for randomisation.
/// Serialised in JSON with `"type"` as a discriminant tag.
#[derive(Debug, Deserialize, Clone, PartialEq)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ParamSpec {
    Int {
        #[serde(default = "default_min_int")]
        min: i64,
        #[serde(default = "default_max_int")]
        max: i64,
        #[serde(default)]
        count: CountSpec,
    },
    AlphaUpper {
        #[serde(default = "default_min_len")]
        min_len: usize,
        #[serde(default = "default_max_len")]
        max_len: usize,
        #[serde(default = "default_multiple_of")]
        multiple_of: usize,
        #[serde(default)]
        count: CountSpec,
    },
    AlphaLower {
        #[serde(default = "default_min_len")]
        min_len: usize,
        #[serde(default = "default_max_len")]
        max_len: usize,
        #[serde(default = "default_multiple_of")]
        multiple_of: usize,
        #[serde(default)]
        count: CountSpec,
    },
    AlphaMixed {
        #[serde(default = "default_min_len")]
        min_len: usize,
        #[serde(default = "default_max_len")]
        max_len: usize,
        #[serde(default = "default_multiple_of")]
        multiple_of: usize,
        #[serde(default)]
        count: CountSpec,
    },
    HexString {
        #[serde(default = "default_min_len")]
        min_len: usize,
        #[serde(default = "default_max_len")]
        max_len: usize,
        #[serde(default = "default_multiple_of")]
        multiple_of: usize,
        #[serde(default)]
        count: CountSpec,
    },
    PrintableAscii {
        #[serde(default = "default_min_len")]
        min_len: usize,
        #[serde(default = "default_max_len")]
        max_len: usize,
        #[serde(default = "default_multiple_of")]
        multiple_of: usize,
        #[serde(default)]
        count: CountSpec,
    },
    Enum {
        values: Vec<String>,
        #[serde(default)]
        count: CountSpec,
    },
    #[cfg(feature = "faker")]
    Faker {
        category: FakerCategory,
        #[serde(default)]
        count: CountSpec,
    },
}

#[cfg(feature = "faker")]
#[derive(Debug, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum FakerCategory {
    Name,
    FirstName,
    LastName,
    Email,
    Company,
    City,
    Country,
}

/// Ordered map of param_name → ParamSpec.
/// `IndexMap` preserves JSON key insertion order, which determines
/// the line order in the generated stdin input string.
pub type Params = IndexMap<String, ParamSpec>;

/// Upper bounds that keep generation cheap and, more importantly, make absurd
/// specs fail LOUDLY (a `Result::Err`) instead of panicking later: an inverted
/// or empty range would otherwise panic inside `rng.gen_range`. These limits are
/// generous for an educational dojo. Validation is enforced in `parse_params`.
const MAX_LEN: usize = 100_000;
const MAX_COUNT: usize = 10_000;

fn validate_count(name: &str, count: &CountSpec) -> Result<(), String> {
    if count.min > count.max {
        return Err(format!(
            "param '{name}': count.min ({}) must be <= count.max ({})",
            count.min, count.max
        ));
    }
    if count.max > MAX_COUNT {
        return Err(format!(
            "param '{name}': count.max ({}) exceeds limit {MAX_COUNT}",
            count.max
        ));
    }
    Ok(())
}

fn validate_len(
    name: &str,
    min_len: usize,
    max_len: usize,
    multiple_of: usize,
) -> Result<(), String> {
    if min_len > max_len {
        return Err(format!(
            "param '{name}': min_len ({min_len}) must be <= max_len ({max_len})"
        ));
    }
    if max_len > MAX_LEN {
        return Err(format!(
            "param '{name}': max_len ({max_len}) exceeds limit {MAX_LEN}"
        ));
    }
    // Mirror `rng::random_len`: ensure at least one multiple of `step` lies in
    // [min_len, max_len], otherwise `gen_range(lo..=hi)` would panic.
    let step = multiple_of.max(1);
    // `div_ceil` avoids the `min_len + step - 1` overflow when `multiple_of` is
    // absurdly large (the result is harmlessly rejected by the lo > hi check).
    let lo = min_len.div_ceil(step);
    let hi = max_len / step;
    if lo > hi {
        return Err(format!(
            "param '{name}': no length in [{min_len}, {max_len}] is a multiple of {step}"
        ));
    }
    Ok(())
}

/// Parse a JSON params object (from VitePress frontmatter) into an ordered Params map.
///
/// Validates every spec so that downstream generation can never panic on an
/// inverted/empty range and never attempts an absurd allocation; invalid specs
/// return a descriptive `Err`.
///
/// Expected format:
/// ```json
/// {
///   "plaintext": {"type": "alpha_upper", "min_len": 5, "max_len": 12},
///   "shift":     {"type": "int", "min": 1, "max": 25}
/// }
/// ```
pub fn parse_params(json_str: &str) -> Result<Params, String> {
    let params: Params = serde_json::from_str(json_str)
        .map_err(|e| format!("JSON parse error: {e}"))?;
    for (name, spec) in &params {
        match spec {
            ParamSpec::Int { min, max, count } => {
                if min > max {
                    return Err(format!(
                        "param '{name}': min ({min}) must be <= max ({max})"
                    ));
                }
                validate_count(name, count)?;
            }
            ParamSpec::AlphaUpper { min_len, max_len, multiple_of, count }
            | ParamSpec::AlphaLower { min_len, max_len, multiple_of, count }
            | ParamSpec::AlphaMixed { min_len, max_len, multiple_of, count }
            | ParamSpec::HexString { min_len, max_len, multiple_of, count }
            | ParamSpec::PrintableAscii { min_len, max_len, multiple_of, count } => {
                validate_len(name, *min_len, *max_len, *multiple_of)?;
                validate_count(name, count)?;
            }
            ParamSpec::Enum { values, count } => {
                if values.is_empty() {
                    return Err(format!("param '{name}': enum values must not be empty"));
                }
                validate_count(name, count)?;
            }
            #[cfg(feature = "faker")]
            ParamSpec::Faker { count, .. } => {
                validate_count(name, count)?;
            }
        }
    }
    Ok(params)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_int_param() {
        let json = r#"{"shift": {"type": "int", "min": 1, "max": 25}}"#;
        let params = parse_params(json).unwrap();
        assert_eq!(params["shift"], ParamSpec::Int { min: 1, max: 25, count: CountSpec::default() });
    }

    #[test]
    fn parses_alpha_upper_param() {
        let json = r#"{"pt": {"type": "alpha_upper", "min_len": 5, "max_len": 12}}"#;
        let params = parse_params(json).unwrap();
        assert_eq!(params["pt"], ParamSpec::AlphaUpper { min_len: 5, max_len: 12, multiple_of: 1, count: CountSpec::default() });
    }

    #[test]
    fn parses_hex_string_param() {
        let json = r#"{"k": {"type": "hex_string", "min_len": 32, "max_len": 32}}"#;
        let params = parse_params(json).unwrap();
        assert_eq!(params["k"], ParamSpec::HexString { min_len: 32, max_len: 32, multiple_of: 1, count: CountSpec::default() });
    }

    #[test]
    fn preserves_param_declaration_order() {
        let json = r#"{"plaintext": {"type": "alpha_upper", "min_len": 5, "max_len": 12}, "shift": {"type": "int", "min": 1, "max": 25}}"#;
        let params = parse_params(json).unwrap();
        let keys: Vec<&str> = params.keys().map(|s| s.as_str()).collect();
        assert_eq!(keys, vec!["plaintext", "shift"]);
    }

    #[test]
    fn returns_error_on_invalid_json() {
        let result = parse_params("not valid json {{{");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("JSON parse error"));
    }

    #[test]
    fn returns_error_on_unknown_param_type() {
        let json = r#"{"x": {"type": "unknown_type"}}"#;
        let result = parse_params(json);
        assert!(result.is_err());
    }

    #[test]
    fn parses_alpha_lower_param() {
        let json = r#"{"pt": {"type": "alpha_lower", "min_len": 3, "max_len": 8}}"#;
        let params = parse_params(json).unwrap();
        assert_eq!(params["pt"], ParamSpec::AlphaLower { min_len: 3, max_len: 8, multiple_of: 1, count: CountSpec::default() });
    }

    #[test]
    fn parses_alpha_mixed_param() {
        let json = r#"{"pt": {"type": "alpha_mixed", "min_len": 4, "max_len": 16}}"#;
        let params = parse_params(json).unwrap();
        assert_eq!(params["pt"], ParamSpec::AlphaMixed { min_len: 4, max_len: 16, multiple_of: 1, count: CountSpec::default() });
    }

    #[test]
    fn parses_printable_ascii_param() {
        let json = r#"{"msg": {"type": "printable_ascii", "min_len": 10, "max_len": 20}}"#;
        let params = parse_params(json).unwrap();
        assert_eq!(params["msg"], ParamSpec::PrintableAscii { min_len: 10, max_len: 20, multiple_of: 1, count: CountSpec::default() });
    }

    #[test]
    fn parses_count_field() {
        // count is now an object with min/max/separator
        let json = r#"{"shift": {"type": "int", "min": 1, "max": 25, "count": {"min": 3, "max": 3}}}"#;
        let params = parse_params(json).unwrap();
        assert_eq!(params["shift"], ParamSpec::Int {
            min: 1,
            max: 25,
            count: CountSpec { min: 3, max: 3, separator: " ".to_string() },
        });
    }

    #[test]
    fn count_defaults_to_one_when_omitted() {
        let json = r#"{"pt": {"type": "alpha_upper", "min_len": 5, "max_len": 10}}"#;
        let params = parse_params(json).unwrap();
        assert_eq!(
            params["pt"],
            ParamSpec::AlphaUpper { min_len: 5, max_len: 10, multiple_of: 1, count: CountSpec::default() }
        );
    }

    #[test]
    fn parses_multiple_params() {
        let json = r#"{"a": {"type": "int", "min": 1, "max": 10}, "b": {"type": "alpha_lower", "min_len": 3, "max_len": 5}}"#;
        let params = parse_params(json).unwrap();
        assert_eq!(params.len(), 2);
        assert_eq!(params["a"], ParamSpec::Int { min: 1, max: 10, count: CountSpec::default() });
        assert_eq!(params["b"], ParamSpec::AlphaLower { min_len: 3, max_len: 5, multiple_of: 1, count: CountSpec::default() });
    }

    #[test]
    fn parses_count_spec_with_min_max_range() {
        // Task 3.2: verify count: { min: 2, max: 5 } deserializes correctly
        let json = r#"{"n": {"type": "int", "min": 1, "max": 100, "count": {"min": 2, "max": 5}}}"#;
        let params = parse_params(json).unwrap();
        assert_eq!(params["n"], ParamSpec::Int {
            min: 1,
            max: 100,
            count: CountSpec { min: 2, max: 5, separator: " ".to_string() },
        });
    }

    #[test]
    fn parses_enum_param() {
        let json = r#"{"mode": {"type": "enum", "values": ["ECB", "CBC"]}}"#;
        let params = parse_params(json).unwrap();
        assert_eq!(params["mode"], ParamSpec::Enum {
            values: vec!["ECB".to_string(), "CBC".to_string()],
            count: CountSpec::default(),
        });
    }

    #[test]
    fn enum_empty_values_returns_error() {
        let json = r#"{"mode": {"type": "enum", "values": []}}"#;
        let result = parse_params(json);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("enum values must not be empty"));
    }

    // ── bounds validation (prevents downstream gen_range panics) ──────────────

    #[test]
    fn int_min_greater_than_max_returns_error() {
        let json = r#"{"n": {"type": "int", "min": 100, "max": 10}}"#;
        let err = parse_params(json).unwrap_err();
        assert!(err.contains("must be <= max"), "got: {err}");
    }

    #[test]
    fn count_min_greater_than_max_returns_error() {
        let json = r#"{"n": {"type": "int", "min": 1, "max": 10, "count": {"min": 5, "max": 2}}}"#;
        let err = parse_params(json).unwrap_err();
        assert!(err.contains("count.min"), "got: {err}");
    }

    #[test]
    fn string_min_len_greater_than_max_len_returns_error() {
        let json = r#"{"s": {"type": "alpha_upper", "min_len": 20, "max_len": 5}}"#;
        let err = parse_params(json).unwrap_err();
        assert!(err.contains("min_len"), "got: {err}");
    }

    #[test]
    fn no_valid_multiple_length_returns_error() {
        // min_len=max_len=3 but multiple_of=16 → no multiple of 16 in [3, 3]
        let json = r#"{"s": {"type": "hex_string", "min_len": 3, "max_len": 3, "multiple_of": 16}}"#;
        let err = parse_params(json).unwrap_err();
        assert!(err.contains("multiple of"), "got: {err}");
    }

    #[test]
    fn oversized_max_len_returns_error() {
        let json = r#"{"s": {"type": "alpha_lower", "min_len": 1, "max_len": 100001}}"#;
        let err = parse_params(json).unwrap_err();
        assert!(err.contains("exceeds limit"), "got: {err}");
    }

    #[test]
    fn oversized_count_returns_error() {
        let json = r#"{"n": {"type": "int", "min": 1, "max": 10, "count": {"min": 1, "max": 100000}}}"#;
        let err = parse_params(json).unwrap_err();
        assert!(err.contains("exceeds limit"), "got: {err}");
    }

    #[test]
    fn valid_bounds_still_parse() {
        let json = r#"{"a": {"type": "int", "min": 1, "max": 10}, "b": {"type": "hex_string", "min_len": 16, "max_len": 64, "multiple_of": 16}}"#;
        assert!(parse_params(json).is_ok());
    }

    #[test]
    fn parses_enum_param_with_count() {
        let json = r#"{"mode": {"type": "enum", "values": ["A", "B", "C"], "count": {"min": 2, "max": 3, "separator": ","}}}"#;
        let params = parse_params(json).unwrap();
        assert_eq!(params["mode"], ParamSpec::Enum {
            values: vec!["A".to_string(), "B".to_string(), "C".to_string()],
            count: CountSpec { min: 2, max: 3, separator: ",".to_string() },
        });
    }

    #[test]
    fn parses_count_spec_with_custom_separator() {
        let json = r#"{"n": {"type": "int", "min": 1, "max": 10, "count": {"min": 3, "max": 3, "separator": ","}}}"#;
        let params = parse_params(json).unwrap();
        assert_eq!(params["n"], ParamSpec::Int {
            min: 1,
            max: 10,
            count: CountSpec { min: 3, max: 3, separator: ",".to_string() },
        });
    }

    #[test]
    fn parses_multiple_of_field() {
        let json = r#"{"pt": {"type": "hex_string", "min_len": 16, "max_len": 64, "multiple_of": 16}}"#;
        let params = parse_params(json).unwrap();
        assert_eq!(params["pt"], ParamSpec::HexString {
            min_len: 16,
            max_len: 64,
            multiple_of: 16,
            count: CountSpec::default(),
        });
    }

    #[test]
    fn multiple_of_defaults_to_one() {
        let json = r#"{"pt": {"type": "hex_string", "min_len": 8, "max_len": 16}}"#;
        let params = parse_params(json).unwrap();
        assert_eq!(params["pt"], ParamSpec::HexString {
            min_len: 8,
            max_len: 16,
            multiple_of: 1,
            count: CountSpec::default(),
        });
    }

    #[cfg(not(feature = "faker"))]
    #[test]
    fn faker_type_fails_without_feature() {
        let json = r#"{"name": {"type": "faker", "category": "name"}}"#;
        let result = parse_params(json);
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(err.contains("unknown variant"), "expected unknown variant error, got: {err}");
    }

    #[cfg(feature = "faker")]
    #[test]
    fn parses_faker_param_with_feature() {
        let json = r#"{"name": {"type": "faker", "category": "name"}}"#;
        let params = parse_params(json).unwrap();
        assert_eq!(params["name"], ParamSpec::Faker {
            category: FakerCategory::Name,
            count: CountSpec::default(),
        });
    }
}
