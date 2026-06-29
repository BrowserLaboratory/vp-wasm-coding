use indexmap::IndexMap;
use rand::Rng;

#[cfg(feature = "faker")]
use fake::Fake;
#[cfg(feature = "faker")]
use crate::parser::FakerCategory;

use crate::parser::ParamSpec;

const UPPER: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWER: &[u8] = b"abcdefghijklmnopqrstuvwxyz";
const HEX_CHARS: &[u8] = b"0123456789abcdef";
const PRINTABLE_ASCII: &[u8] = b"!\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~";

/// Generate a single stdin input string from ordered params.
/// Each param value occupies one line, joined with '\n' in declaration order.
pub fn generate_input<R: Rng>(specs: &IndexMap<String, ParamSpec>, rng: &mut R) -> String {
    specs
        .values()
        .map(|spec| generate_one(spec, rng))
        .collect::<Vec<_>>()
        .join("\n")
}

fn generate_one<R: Rng>(spec: &ParamSpec, rng: &mut R) -> String {
    let count_spec = match spec {
        ParamSpec::Int { count, .. } => count,
        ParamSpec::AlphaUpper { count, .. } => count,
        ParamSpec::AlphaLower { count, .. } => count,
        ParamSpec::AlphaMixed { count, .. } => count,
        ParamSpec::HexString { count, .. } => count,
        ParamSpec::PrintableAscii { count, .. } => count,
        ParamSpec::Enum { count, .. } => count,
        #[cfg(feature = "faker")]
        ParamSpec::Faker { count, .. } => count,
    };

    debug_assert!(count_spec.min <= count_spec.max, "CountSpec.min must be <= max");

    let actual_count = rng.gen_range(count_spec.min..=count_spec.max);
    (0..actual_count)
        .map(|_| generate_single(spec, rng))
        .collect::<Vec<_>>()
        .join(&count_spec.separator)
}

/// Pick a random length in [min_len, max_len] that is a multiple of `multiple_of`.
/// If multiple_of is 1 (the default), this is equivalent to gen_range(min..=max).
fn random_len<R: Rng>(min_len: usize, max_len: usize, multiple_of: usize, rng: &mut R) -> usize {
    let step = multiple_of.max(1);
    // Smallest multiple of `step` that is >= min_len
    let lo = (min_len + step - 1) / step;
    // Largest multiple of `step` that is <= max_len
    let hi = max_len / step;
    debug_assert!(lo <= hi, "no valid length: min_len={min_len}, max_len={max_len}, multiple_of={step}");
    rng.gen_range(lo..=hi) * step
}

/// Produce a single value for the given spec.
fn generate_single<R: Rng>(spec: &ParamSpec, rng: &mut R) -> String {
    match spec {
        ParamSpec::Int { min, max, .. } => rng.gen_range(*min..=*max).to_string(),
        ParamSpec::AlphaUpper { min_len, max_len, multiple_of, .. } => {
            let len = random_len(*min_len, *max_len, *multiple_of, rng);
            (0..len)
                .map(|_| UPPER[rng.gen_range(0..UPPER.len())] as char)
                .collect()
        }
        ParamSpec::AlphaLower { min_len, max_len, multiple_of, .. } => {
            let len = random_len(*min_len, *max_len, *multiple_of, rng);
            (0..len)
                .map(|_| LOWER[rng.gen_range(0..LOWER.len())] as char)
                .collect()
        }
        ParamSpec::AlphaMixed { min_len, max_len, multiple_of, .. } => {
            let combined: Vec<u8> = UPPER.iter().chain(LOWER.iter()).copied().collect();
            let len = random_len(*min_len, *max_len, *multiple_of, rng);
            (0..len)
                .map(|_| combined[rng.gen_range(0..combined.len())] as char)
                .collect()
        }
        ParamSpec::HexString { min_len, max_len, multiple_of, .. } => {
            let len = random_len(*min_len, *max_len, *multiple_of, rng);
            (0..len)
                .map(|_| HEX_CHARS[rng.gen_range(0..HEX_CHARS.len())] as char)
                .collect()
        }
        ParamSpec::PrintableAscii { min_len, max_len, multiple_of, .. } => {
            let len = random_len(*min_len, *max_len, *multiple_of, rng);
            (0..len)
                .map(|_| PRINTABLE_ASCII[rng.gen_range(0..PRINTABLE_ASCII.len())] as char)
                .collect()
        }
        ParamSpec::Enum { values, .. } => {
            values[rng.gen_range(0..values.len())].clone()
        }
        #[cfg(feature = "faker")]
        ParamSpec::Faker { category, .. } => generate_fake(category, rng),
    }
}

#[cfg(feature = "faker")]
fn generate_fake<R: Rng>(category: &FakerCategory, rng: &mut R) -> String {
    use fake::faker::{
        name::en::{Name, FirstName, LastName},
        internet::en::SafeEmail,
        company::en::CompanyName,
        address::en::{CityName, CountryName},
    };
    match category {
        FakerCategory::Name => Name().fake_with_rng(rng),
        FakerCategory::FirstName => FirstName().fake_with_rng(rng),
        FakerCategory::LastName => LastName().fake_with_rng(rng),
        FakerCategory::Email => SafeEmail().fake_with_rng(rng),
        FakerCategory::Company => CompanyName().fake_with_rng(rng),
        FakerCategory::City => CityName().fake_with_rng(rng),
        FakerCategory::Country => CountryName().fake_with_rng(rng),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::parser::CountSpec;
    use rand::SeedableRng;
    use rand::rngs::SmallRng;

    fn seeded() -> SmallRng {
        SmallRng::seed_from_u64(42)
    }

    fn make_params(pairs: &[(&str, ParamSpec)]) -> IndexMap<String, ParamSpec> {
        pairs.iter().map(|(k, v)| (k.to_string(), v.clone())).collect()
    }

    #[test]
    fn int_within_range() {
        let mut rng = seeded();
        let spec = ParamSpec::Int { min: 1, max: 25, count: CountSpec::default() };
        for _ in 0..100 {
            let v: i64 = generate_one(&spec, &mut rng).parse().unwrap();
            assert!((1..=25).contains(&v));
        }
    }

    #[test]
    fn alpha_upper_only_uppercase() {
        let mut rng = seeded();
        let spec = ParamSpec::AlphaUpper { min_len: 5, max_len: 10, multiple_of: 1, count: CountSpec::default() };
        let v = generate_one(&spec, &mut rng);
        assert!(v.chars().all(|c| c.is_ascii_uppercase()));
        assert!((5..=10).contains(&v.len()));
    }

    #[test]
    fn hex_string_valid_chars() {
        let mut rng = seeded();
        let spec = ParamSpec::HexString { min_len: 4, max_len: 8, multiple_of: 1, count: CountSpec::default() };
        let v = generate_one(&spec, &mut rng);
        assert!(v.chars().all(|c| c.is_ascii_hexdigit()));
    }

    #[test]
    fn deterministic_with_seed() {
        let spec = ParamSpec::Int { min: 0, max: 1000, count: CountSpec::default() };
        let v1 = generate_one(&spec, &mut SmallRng::seed_from_u64(7));
        let v2 = generate_one(&spec, &mut SmallRng::seed_from_u64(7));
        assert_eq!(v1, v2);
    }

    #[test]
    fn alpha_lower_only_lowercase() {
        let mut rng = seeded();
        let spec = ParamSpec::AlphaLower { min_len: 5, max_len: 10, multiple_of: 1, count: CountSpec::default() };
        let v = generate_one(&spec, &mut rng);
        assert!(v.chars().all(|c| c.is_ascii_lowercase()), "expected all lowercase, got: {v}");
        assert!((5..=10).contains(&v.len()));
    }

    #[test]
    fn alpha_mixed_only_alpha() {
        let mut rng = seeded();
        let spec = ParamSpec::AlphaMixed { min_len: 20, max_len: 30, multiple_of: 1, count: CountSpec::default() };
        let v = generate_one(&spec, &mut rng);
        assert!(v.chars().all(|c| c.is_ascii_alphabetic()), "expected only alpha chars, got: {v}");
        assert!((20..=30).contains(&v.len()));
    }

    #[test]
    fn alpha_mixed_contains_both_cases() {
        let mut rng = seeded();
        let spec = ParamSpec::AlphaMixed { min_len: 50, max_len: 50, multiple_of: 1, count: CountSpec::default() };
        let v = generate_one(&spec, &mut rng);
        assert!(v.chars().any(|c| c.is_ascii_uppercase()), "expected at least one uppercase");
        assert!(v.chars().any(|c| c.is_ascii_lowercase()), "expected at least one lowercase");
    }

    #[test]
    fn printable_ascii_valid_chars() {
        let mut rng = seeded();
        let spec = ParamSpec::PrintableAscii { min_len: 20, max_len: 30, multiple_of: 1, count: CountSpec::default() };
        let v = generate_one(&spec, &mut rng);
        assert!(
            v.chars().all(|c| c as u8 >= 0x21 && c as u8 <= 0x7e),
            "expected printable non-space ASCII (0x21–0x7e), got: {v}"
        );
        assert!((20..=30).contains(&v.len()));
    }

    #[test]
    fn count_greater_than_one_produces_space_separated_values() {
        let mut rng = seeded();
        let spec = ParamSpec::Int {
            min: 1,
            max: 100,
            count: CountSpec { min: 3, max: 3, separator: " ".to_string() },
        };
        let v = generate_one(&spec, &mut rng);
        let parts: Vec<&str> = v.split(' ').collect();
        assert_eq!(parts.len(), 3, "expected 3 space-separated values, got: {v}");
        for part in parts {
            let n: i64 = part.parse().expect("each part should be a valid integer");
            assert!((1..=100).contains(&n));
        }
    }

    #[test]
    fn count_one_produces_no_spaces_for_int() {
        let mut rng = seeded();
        let spec = ParamSpec::Int { min: 0, max: 1000, count: CountSpec::default() };
        let v = generate_one(&spec, &mut rng);
        assert!(!v.contains(' '), "count=1 should produce a single value with no spaces, got: {v}");
    }

    #[test]
    fn generate_input_joins_in_declaration_order() {
        let params = make_params(&[
            ("plaintext", ParamSpec::AlphaUpper { min_len: 5, max_len: 5, multiple_of: 1, count: CountSpec::default() }),
            ("shift", ParamSpec::Int { min: 3, max: 3, count: CountSpec::default() }),
        ]);
        let mut rng = seeded();
        let input = generate_input(&params, &mut rng);
        let lines: Vec<&str> = input.lines().collect();
        assert_eq!(lines.len(), 2);
        assert!(lines[0].chars().all(|c| c.is_ascii_uppercase()), "first line should be alpha_upper");
        assert_eq!(lines[1], "3", "second line should be the fixed shift=3");
    }

    #[test]
    fn generate_input_single_param() {
        let params = make_params(&[("n", ParamSpec::Int { min: 42, max: 42, count: CountSpec::default() })]);
        let mut rng = seeded();
        let input = generate_input(&params, &mut rng);
        assert_eq!(input, "42");
    }

    #[test]
    fn generate_input_three_params_ordered() {
        let params = make_params(&[
            ("m", ParamSpec::Int { min: 65, max: 65, count: CountSpec::default() }),
            ("e", ParamSpec::Int { min: 17, max: 17, count: CountSpec::default() }),
            ("n", ParamSpec::Int { min: 3233, max: 3233, count: CountSpec::default() }),
        ]);
        let mut rng = seeded();
        let input = generate_input(&params, &mut rng);
        assert_eq!(input, "65\n17\n3233");
    }

    #[test]
    fn test_multiple_count_space_separated() {
        let mut rng = seeded();
        let spec = ParamSpec::Int {
            min: 5,
            max: 5,
            count: CountSpec { min: 4, max: 4, separator: " ".to_string() },
        };
        let v = generate_one(&spec, &mut rng);
        assert_eq!(v, "5 5 5 5");
    }

    // Task 3.4: CountSpec with min and max generates variable number of values
    #[test]
    fn count_spec_variable_count_within_range() {
        let spec = ParamSpec::Int {
            min: 1,
            max: 1,
            count: CountSpec { min: 2, max: 5, separator: " ".to_string() },
        };
        // Run many times to confirm count always stays within [2, 5]
        for seed in 0..200u64 {
            let mut rng = SmallRng::seed_from_u64(seed);
            let v = generate_one(&spec, &mut rng);
            let parts: Vec<&str> = v.split(' ').collect();
            assert!(
                (2..=5).contains(&parts.len()),
                "seed={seed}: expected 2–5 parts, got {} (value: {v})", parts.len()
            );
        }
    }

    // Task 3.5: CountSpec with custom separator joins values correctly
    #[test]
    fn count_spec_custom_separator_comma() {
        let mut rng = seeded();
        let spec = ParamSpec::Int {
            min: 7,
            max: 7,
            count: CountSpec { min: 3, max: 3, separator: ",".to_string() },
        };
        let v = generate_one(&spec, &mut rng);
        assert_eq!(v, "7,7,7", "expected comma-separated values, got: {v}");
        assert!(!v.contains(' '), "should use comma, not space");
    }

    #[test]
    fn count_spec_custom_separator_no_trailing() {
        let mut rng = seeded();
        let spec = ParamSpec::Int {
            min: 3,
            max: 3,
            count: CountSpec { min: 2, max: 2, separator: "|".to_string() },
        };
        let v = generate_one(&spec, &mut rng);
        assert_eq!(v, "3|3", "expected pipe-separated values without trailing separator");
        // Must not end with the separator
        assert!(!v.ends_with('|'), "should have no trailing separator");
    }

    #[test]
    fn enum_selects_from_values() {
        let mut rng = seeded();
        let spec = ParamSpec::Enum {
            values: vec!["ECB".to_string(), "CBC".to_string()],
            count: CountSpec::default(),
        };
        for _ in 0..100 {
            let v = generate_one(&spec, &mut rng);
            assert!(
                v == "ECB" || v == "CBC",
                "expected ECB or CBC, got: {v}"
            );
        }
    }

    #[test]
    fn enum_with_count_generates_multiple() {
        let mut rng = seeded();
        let spec = ParamSpec::Enum {
            values: vec!["A".to_string(), "B".to_string(), "C".to_string()],
            count: CountSpec { min: 3, max: 3, separator: ",".to_string() },
        };
        let v = generate_one(&spec, &mut rng);
        let parts: Vec<&str> = v.split(',').collect();
        assert_eq!(parts.len(), 3, "expected 3 comma-separated values, got: {v}");
        for part in parts {
            assert!(
                part == "A" || part == "B" || part == "C",
                "expected A, B, or C, got: {part}"
            );
        }
    }

    #[test]
    fn hex_string_multiple_of_respects_constraint() {
        let spec = ParamSpec::HexString {
            min_len: 16,
            max_len: 64,
            multiple_of: 16,
            count: CountSpec::default(),
        };
        for seed in 0..200u64 {
            let mut rng = SmallRng::seed_from_u64(seed);
            let v = generate_one(&spec, &mut rng);
            assert!(
                v.len() % 16 == 0,
                "seed={seed}: expected length multiple of 16, got {} (len={})", v, v.len()
            );
            assert!(
                (16..=64).contains(&v.len()),
                "seed={seed}: expected length in [16, 64], got {}", v.len()
            );
        }
    }

    #[test]
    fn multiple_of_1_is_same_as_no_constraint() {
        let spec = ParamSpec::AlphaUpper {
            min_len: 5,
            max_len: 10,
            multiple_of: 1,
            count: CountSpec::default(),
        };
        for seed in 0..50u64 {
            let mut rng = SmallRng::seed_from_u64(seed);
            let v = generate_one(&spec, &mut rng);
            assert!((5..=10).contains(&v.len()));
        }
    }

    #[test]
    fn enum_deterministic_with_seed() {
        let spec = ParamSpec::Enum {
            values: vec!["X".to_string(), "Y".to_string(), "Z".to_string()],
            count: CountSpec::default(),
        };
        let v1 = generate_one(&spec, &mut SmallRng::seed_from_u64(7));
        let v2 = generate_one(&spec, &mut SmallRng::seed_from_u64(7));
        assert_eq!(v1, v2);
    }

    #[cfg(feature = "faker")]
    mod faker_tests {
        use super::*;
        use crate::parser::FakerCategory;

        #[test]
        fn faker_generates_name() {
            let mut rng = seeded();
            let spec = ParamSpec::Faker {
                category: FakerCategory::Name,
                count: CountSpec::default(),
            };
            let v = generate_one(&spec, &mut rng);
            assert!(!v.is_empty(), "faker name should be non-empty");
        }

        #[test]
        fn faker_with_count_generates_multiple() {
            let mut rng = seeded();
            let spec = ParamSpec::Faker {
                category: FakerCategory::Email,
                count: CountSpec { min: 2, max: 2, separator: ",".to_string() },
            };
            let v = generate_one(&spec, &mut rng);
            let parts: Vec<&str> = v.split(',').collect();
            assert_eq!(parts.len(), 2, "expected 2 comma-separated emails, got: {v}");
            for part in parts {
                assert!(part.contains('@'), "expected email-like string, got: {part}");
            }
        }

        #[test]
        fn faker_all_categories_produce_nonempty() {
            let mut rng = seeded();
            let categories = [
                FakerCategory::Name,
                FakerCategory::FirstName,
                FakerCategory::LastName,
                FakerCategory::Email,
                FakerCategory::Company,
                FakerCategory::City,
                FakerCategory::Country,
            ];
            for cat in categories {
                let spec = ParamSpec::Faker {
                    category: cat.clone(),
                    count: CountSpec::default(),
                };
                let v = generate_one(&spec, &mut rng);
                assert!(!v.is_empty(), "faker {:?} should be non-empty", cat);
            }
        }
    }
}
