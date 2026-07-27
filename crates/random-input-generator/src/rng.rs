use indexmap::IndexMap;
use rand::Rng;
use std::collections::HashSet;

#[cfg(feature = "faker")]
use fake::Fake;
#[cfg(feature = "faker")]
use crate::parser::FakerCategory;

use crate::parser::{CountSpec, ParamSpec};

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
    // `parse_params` guarantees count.min <= count.max, so gen_range cannot panic.
    let common = common_fields(spec);

    let actual_count = rng.gen_range(common.count.min..=common.count.max);
    let values = if common.distinct {
        generate_distinct(spec, actual_count, rng)
    } else {
        (0..actual_count).map(|_| generate_single(spec, rng)).collect()
    };
    // Join semantics: with prefix_count the actual count `n` is just the first
    // token of the same sequence — the separator only appears between tokens,
    // so `n = 0` yields exactly "0" and the non-prefixed empty line stays "".
    let tokens: Vec<String> = if common.prefix_count {
        std::iter::once(actual_count.to_string()).chain(values).collect()
    } else {
        values
    };
    tokens.join(&common.count.separator)
}

/// The fields shared by every `ParamSpec` variant, extracted by name — the
/// named struct (instead of a positional tuple) makes a distinct/prefix_count
/// transposition in any match arm a compile error rather than a silent swap.
struct CommonFields<'a> {
    count: &'a CountSpec,
    distinct: bool,
    prefix_count: bool,
}

fn common_fields(spec: &ParamSpec) -> CommonFields<'_> {
    match spec {
        ParamSpec::Int { count, distinct, prefix_count, .. }
        | ParamSpec::AlphaUpper { count, distinct, prefix_count, .. }
        | ParamSpec::AlphaLower { count, distinct, prefix_count, .. }
        | ParamSpec::AlphaMixed { count, distinct, prefix_count, .. }
        | ParamSpec::HexString { count, distinct, prefix_count, .. }
        | ParamSpec::PrintableAscii { count, distinct, prefix_count, .. }
        | ParamSpec::Enum { count, distinct, prefix_count, .. } => CommonFields {
            count,
            distinct: *distinct,
            prefix_count: *prefix_count,
        },
        #[cfg(feature = "faker")]
        ParamSpec::Faker { count, distinct, prefix_count, .. } => CommonFields {
            count,
            distinct: *distinct,
            prefix_count: *prefix_count,
        },
    }
}

/// Threshold factor for choosing the distinct-sampling strategy: domains up to
/// `EXPAND_FACTOR × n` (the actually-drawn count, not `count.max`) are
/// materialised and partially shuffled (exact, handles the tight permutation
/// case); larger domains use rejection sampling, where the per-draw collision
/// probability stays below 1/EXPAND_FACTOR. Comparing against `n` instead of
/// `count.max` avoids materialising a pool sized for the worst-case count when
/// the actual draw is much smaller (e.g. `count: {min: 1, max: 10000}` drawing
/// `n = 1`).
const EXPAND_FACTOR: i128 = 4;

/// Sample `n` pairwise-distinct values for a distinct-enabled spec.
/// Only `int` and `enum` reach here; `parse_params` rejects `distinct: true`
/// on every other type at construction time.
fn generate_distinct<R: Rng>(spec: &ParamSpec, n: usize, rng: &mut R) -> Vec<String> {
    match spec {
        ParamSpec::Int { min, max, .. } => {
            let domain_size = (*max as i128) - (*min as i128) + 1;
            if domain_size <= EXPAND_FACTOR * n as i128 {
                // Small domain: materialise and partially shuffle. Covers the
                // tight case (domain == n → random permutation of the domain).
                let pool: Vec<i64> = (*min..=*max).collect();
                partial_shuffle_take(pool, n, rng)
                    .into_iter()
                    .map(|v| v.to_string())
                    .collect()
            } else {
                // Large domain: rejection sampling. parse_params guarantees
                // domain_size >= count.max >= n, so this terminates; with
                // domain > EXPAND_FACTOR × n the expected number of
                // retries per draw is below 1/(EXPAND_FACTOR - 1).
                let mut seen = HashSet::with_capacity(n);
                let mut out = Vec::with_capacity(n);
                while out.len() < n {
                    let v = rng.gen_range(*min..=*max);
                    if seen.insert(v) {
                        out.push(v.to_string());
                    }
                }
                out
            }
        }
        ParamSpec::Enum { values, .. } => {
            // Deduplicate preserving first occurrence, then partially shuffle.
            let mut seen = HashSet::new();
            let pool: Vec<String> = values
                .iter()
                .filter(|v| seen.insert(v.as_str()))
                .cloned()
                .collect();
            partial_shuffle_take(pool, n, rng)
        }
        // Explicit arms (no wildcard): adding a ParamSpec variant must be a
        // compile error here, not a release-time panic — same principle as
        // CommonFields replacing the positional tuple.
        ParamSpec::AlphaUpper { .. }
        | ParamSpec::AlphaLower { .. }
        | ParamSpec::AlphaMixed { .. }
        | ParamSpec::HexString { .. }
        | ParamSpec::PrintableAscii { .. } => {
            unreachable!("distinct on string types is rejected by parse_params")
        }
        #[cfg(feature = "faker")]
        ParamSpec::Faker { .. } => {
            unreachable!("distinct on faker types is rejected by parse_params")
        }
    }
}

/// Partial Fisher–Yates: shuffle the first `n` positions of `pool` and keep
/// them. The result is a uniformly random n-subset in uniformly random order.
/// Caller guarantees `n <= pool.len()` (enforced by parse_params).
fn partial_shuffle_take<T, R: Rng>(mut pool: Vec<T>, n: usize, rng: &mut R) -> Vec<T> {
    // Active in release too (unlike debug_assert!): if the parse-layer
    // invariant is ever broken, fail with a self-describing message instead
    // of an opaque gen_range panic deep inside rand.
    assert!(
        n <= pool.len(),
        "partial_shuffle_take: n ({n}) must be <= pool.len() ({})",
        pool.len()
    );
    for i in 0..n {
        let j = rng.gen_range(i..pool.len());
        pool.swap(i, j);
    }
    pool.truncate(n);
    pool
}

/// Pick a random length in [min_len, max_len] that is a multiple of `multiple_of`.
/// If multiple_of is 1 (the default), this is equivalent to gen_range(min..=max).
fn random_len<R: Rng>(min_len: usize, max_len: usize, multiple_of: usize, rng: &mut R) -> usize {
    let step = multiple_of.max(1);
    // Smallest multiple of `step` that is >= min_len (div_ceil mirrors
    // parse_params::validate_len — keeps both sides overflow-safe by the
    // same construction).
    let lo = min_len.div_ceil(step);
    // Largest multiple of `step` that is <= max_len
    let hi = max_len / step;
    // `parse_params::validate_len` guarantees at least one multiple of `step`
    // lies in [min_len, max_len], so lo <= hi holds and gen_range cannot panic.
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
        let spec = ParamSpec::Int { min: 1, max: 25, count: CountSpec::default(), distinct: false, prefix_count: false };
        for _ in 0..100 {
            let v: i64 = generate_one(&spec, &mut rng).parse().unwrap();
            assert!((1..=25).contains(&v));
        }
    }

    #[test]
    fn alpha_upper_only_uppercase() {
        let mut rng = seeded();
        let spec = ParamSpec::AlphaUpper { min_len: 5, max_len: 10, multiple_of: 1, count: CountSpec::default(), distinct: false, prefix_count: false };
        let v = generate_one(&spec, &mut rng);
        assert!(v.chars().all(|c| c.is_ascii_uppercase()));
        assert!((5..=10).contains(&v.len()));
    }

    #[test]
    fn hex_string_valid_chars() {
        let mut rng = seeded();
        let spec = ParamSpec::HexString { min_len: 4, max_len: 8, multiple_of: 1, count: CountSpec::default(), distinct: false, prefix_count: false };
        let v = generate_one(&spec, &mut rng);
        assert!(v.chars().all(|c| c.is_ascii_hexdigit()));
    }

    #[test]
    fn deterministic_with_seed() {
        let spec = ParamSpec::Int { min: 0, max: 1000, count: CountSpec::default(), distinct: false, prefix_count: false };
        let v1 = generate_one(&spec, &mut SmallRng::seed_from_u64(7));
        let v2 = generate_one(&spec, &mut SmallRng::seed_from_u64(7));
        assert_eq!(v1, v2);
    }

    #[test]
    fn alpha_lower_only_lowercase() {
        let mut rng = seeded();
        let spec = ParamSpec::AlphaLower { min_len: 5, max_len: 10, multiple_of: 1, count: CountSpec::default(), distinct: false, prefix_count: false };
        let v = generate_one(&spec, &mut rng);
        assert!(v.chars().all(|c| c.is_ascii_lowercase()), "expected all lowercase, got: {v}");
        assert!((5..=10).contains(&v.len()));
    }

    #[test]
    fn alpha_mixed_only_alpha() {
        let mut rng = seeded();
        let spec = ParamSpec::AlphaMixed { min_len: 20, max_len: 30, multiple_of: 1, count: CountSpec::default(), distinct: false, prefix_count: false };
        let v = generate_one(&spec, &mut rng);
        assert!(v.chars().all(|c| c.is_ascii_alphabetic()), "expected only alpha chars, got: {v}");
        assert!((20..=30).contains(&v.len()));
    }

    #[test]
    fn alpha_mixed_contains_both_cases() {
        let mut rng = seeded();
        let spec = ParamSpec::AlphaMixed { min_len: 50, max_len: 50, multiple_of: 1, count: CountSpec::default(), distinct: false, prefix_count: false };
        let v = generate_one(&spec, &mut rng);
        assert!(v.chars().any(|c| c.is_ascii_uppercase()), "expected at least one uppercase");
        assert!(v.chars().any(|c| c.is_ascii_lowercase()), "expected at least one lowercase");
    }

    #[test]
    fn printable_ascii_valid_chars() {
        let mut rng = seeded();
        let spec = ParamSpec::PrintableAscii { min_len: 20, max_len: 30, multiple_of: 1, count: CountSpec::default(), distinct: false, prefix_count: false };
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
            distinct: false,
            prefix_count: false,
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
        let spec = ParamSpec::Int { min: 0, max: 1000, count: CountSpec::default(), distinct: false, prefix_count: false };
        let v = generate_one(&spec, &mut rng);
        assert!(!v.contains(' '), "count=1 should produce a single value with no spaces, got: {v}");
    }

    #[test]
    fn generate_input_joins_in_declaration_order() {
        let params = make_params(&[
            ("plaintext", ParamSpec::AlphaUpper { min_len: 5, max_len: 5, multiple_of: 1, count: CountSpec::default(), distinct: false, prefix_count: false }),
            ("shift", ParamSpec::Int { min: 3, max: 3, count: CountSpec::default(), distinct: false, prefix_count: false }),
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
        let params = make_params(&[("n", ParamSpec::Int { min: 42, max: 42, count: CountSpec::default(), distinct: false, prefix_count: false })]);
        let mut rng = seeded();
        let input = generate_input(&params, &mut rng);
        assert_eq!(input, "42");
    }

    #[test]
    fn generate_input_three_params_ordered() {
        let params = make_params(&[
            ("m", ParamSpec::Int { min: 65, max: 65, count: CountSpec::default(), distinct: false, prefix_count: false }),
            ("e", ParamSpec::Int { min: 17, max: 17, count: CountSpec::default(), distinct: false, prefix_count: false }),
            ("n", ParamSpec::Int { min: 3233, max: 3233, count: CountSpec::default(), distinct: false, prefix_count: false }),
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
            distinct: false,
            prefix_count: false,
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
            distinct: false,
            prefix_count: false,
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
            distinct: false,
            prefix_count: false,
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
            distinct: false,
            prefix_count: false,
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
            distinct: false,
            prefix_count: false,
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
            distinct: false,
            prefix_count: false,
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
            distinct: false,
            prefix_count: false,
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
            distinct: false,
            prefix_count: false,
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
            distinct: false,
            prefix_count: false,
        };
        let v1 = generate_one(&spec, &mut SmallRng::seed_from_u64(7));
        let v2 = generate_one(&spec, &mut SmallRng::seed_from_u64(7));
        assert_eq!(v1, v2);
    }

    // ── distinct sampling (M1, M7–M9, M18, M20) ──────────────────────────────

    fn parse_one(json: &str) -> ParamSpec {
        crate::parser::parse_params(json).unwrap().shift_remove_index(0).unwrap().1
    }

    #[test]
    fn distinct_int_values_are_pairwise_distinct() {
        // M1: general case, rejection-sampling path (huge domain)
        let spec = parse_one(
            r#"{"n": {"type": "int", "min": 1, "max": 1000000000, "count": {"min": 5, "max": 20}, "distinct": true}}"#,
        );
        for seed in 0..100u64 {
            let mut rng = SmallRng::seed_from_u64(seed);
            let line = generate_one(&spec, &mut rng);
            let parts: Vec<i64> = line.split(' ').map(|p| p.parse().unwrap()).collect();
            assert!((5..=20).contains(&parts.len()), "seed={seed}: count out of range: {line}");
            let unique: std::collections::HashSet<_> = parts.iter().collect();
            assert_eq!(unique.len(), parts.len(), "seed={seed}: duplicates in: {line}");
            assert!(parts.iter().all(|v| (1..=1_000_000_000).contains(v)), "seed={seed}: out of range: {line}");
        }
    }

    #[test]
    fn distinct_tight_domain_is_permutation() {
        // M7/M8/M9: domain size == count.min == count.max → random permutation
        let spec = parse_one(
            r#"{"n": {"type": "int", "min": 1, "max": 5, "count": {"min": 5, "max": 5}, "distinct": true}}"#,
        );
        for seed in 0..100u64 {
            let mut rng = SmallRng::seed_from_u64(seed);
            let line = generate_one(&spec, &mut rng);
            let mut parts: Vec<i64> = line.split(' ').map(|p| p.parse().unwrap()).collect();
            parts.sort_unstable();
            assert_eq!(parts, vec![1, 2, 3, 4, 5], "seed={seed}: not a permutation: {line}");
        }
    }

    #[test]
    fn distinct_permutation_order_varies_across_seeds() {
        // The permutation must be random, not the sorted domain every time
        let spec = parse_one(
            r#"{"n": {"type": "int", "min": 1, "max": 5, "count": {"min": 5, "max": 5}, "distinct": true}}"#,
        );
        let lines: std::collections::HashSet<String> = (0..50u64)
            .map(|seed| generate_one(&spec, &mut SmallRng::seed_from_u64(seed)))
            .collect();
        assert!(lines.len() > 1, "all 50 seeds produced the same order");
    }

    #[test]
    fn distinct_enum_dedups_then_permutes() {
        // M18/M20: duplicated values are deduplicated before sampling
        let spec = parse_one(
            r#"{"c": {"type": "enum", "values": ["r", "g", "b", "r"], "count": {"min": 3, "max": 3}, "distinct": true}}"#,
        );
        for seed in 0..50u64 {
            let mut rng = SmallRng::seed_from_u64(seed);
            let line = generate_one(&spec, &mut rng);
            let mut parts: Vec<&str> = line.split(' ').collect();
            parts.sort_unstable();
            assert_eq!(parts, vec!["b", "g", "r"], "seed={seed}: not a dedup permutation: {line}");
        }
    }

    #[test]
    fn distinct_expansion_path_boundary() {
        // domain size (8) <= 4 × n (8) — exact threshold boundary, lands on
        // the materialise-and-shuffle path with n < domain
        let spec = parse_one(
            r#"{"n": {"type": "int", "min": 1, "max": 8, "count": {"min": 2, "max": 2}, "distinct": true}}"#,
        );
        for seed in 0..100u64 {
            let mut rng = SmallRng::seed_from_u64(seed);
            let line = generate_one(&spec, &mut rng);
            let parts: Vec<i64> = line.split(' ').map(|p| p.parse().unwrap()).collect();
            assert_eq!(parts.len(), 2);
            assert_ne!(parts[0], parts[1], "seed={seed}: duplicate pair: {line}");
        }
    }

    // ── prefix_count output format (M2–M6, M10–M12) ──────────────────────────

    #[test]
    fn prefix_count_int_default_separator() {
        // M2: `n x1 ... xn` with n = actual count
        let spec = parse_one(
            r#"{"n": {"type": "int", "min": 1, "max": 100, "count": {"min": 3, "max": 3}, "prefix_count": true}}"#,
        );
        let mut rng = seeded();
        let line = generate_one(&spec, &mut rng);
        let parts: Vec<&str> = line.split(' ').collect();
        assert_eq!(parts.len(), 4, "expected `3 x1 x2 x3`, got: {line}");
        assert_eq!(parts[0], "3", "first token must be the actual count, got: {line}");
        for p in &parts[1..] {
            let v: i64 = p.parse().unwrap();
            assert!((1..=100).contains(&v));
        }
    }

    #[test]
    fn prefix_count_reports_actual_count_not_count_max() {
        // n is the drawn count, not count.max
        let spec = parse_one(
            r#"{"n": {"type": "int", "min": 1, "max": 100, "count": {"min": 2, "max": 8}, "prefix_count": true}}"#,
        );
        for seed in 0..100u64 {
            let mut rng = SmallRng::seed_from_u64(seed);
            let line = generate_one(&spec, &mut rng);
            let parts: Vec<&str> = line.split(' ').collect();
            let n: usize = parts[0].parse().unwrap();
            assert!((2..=8).contains(&n), "seed={seed}: prefix out of range: {line}");
            assert_eq!(parts.len(), n + 1, "seed={seed}: prefix must equal value count: {line}");
        }
    }

    #[test]
    fn prefix_count_string_type() {
        // M3: same format with string values
        let spec = parse_one(
            r#"{"s": {"type": "alpha_upper", "min_len": 2, "max_len": 4, "count": {"min": 2, "max": 2}, "prefix_count": true}}"#,
        );
        let mut rng = seeded();
        let line = generate_one(&spec, &mut rng);
        let parts: Vec<&str> = line.split(' ').collect();
        assert_eq!(parts.len(), 3, "expected `2 s1 s2`, got: {line}");
        assert_eq!(parts[0], "2");
        for p in &parts[1..] {
            assert!(p.chars().all(|c| c.is_ascii_uppercase()));
        }
    }

    #[test]
    fn prefix_count_enum() {
        // M4: same format with enum values
        let spec = parse_one(
            r#"{"c": {"type": "enum", "values": ["r", "g"], "count": {"min": 2, "max": 2}, "prefix_count": true}}"#,
        );
        let mut rng = seeded();
        let line = generate_one(&spec, &mut rng);
        let parts: Vec<&str> = line.split(' ').collect();
        assert_eq!(parts.len(), 3);
        assert_eq!(parts[0], "2");
        for p in &parts[1..] {
            assert!(*p == "r" || *p == "g");
        }
    }

    #[test]
    fn prefix_count_custom_separator_join_semantics() {
        // M5: `n,x1,x2` — the prefix shares the separator, none trailing
        let spec = parse_one(
            r#"{"n": {"type": "int", "min": 7, "max": 7, "count": {"min": 2, "max": 2, "separator": ","}, "prefix_count": true}}"#,
        );
        let mut rng = seeded();
        let line = generate_one(&spec, &mut rng);
        assert_eq!(line, "2,7,7", "expected join semantics with comma, got: {line}");
    }

    #[test]
    fn prefix_count_combined_with_distinct() {
        // M6: both features at once
        let spec = parse_one(
            r#"{"n": {"type": "int", "min": 1, "max": 1000000, "count": {"min": 5, "max": 8}, "distinct": true, "prefix_count": true}}"#,
        );
        for seed in 0..50u64 {
            let mut rng = SmallRng::seed_from_u64(seed);
            let line = generate_one(&spec, &mut rng);
            let parts: Vec<&str> = line.split(' ').collect();
            let n: usize = parts[0].parse().unwrap();
            assert!((5..=8).contains(&n), "seed={seed}: {line}");
            assert_eq!(parts.len(), n + 1, "seed={seed}: {line}");
            let unique: std::collections::HashSet<_> = parts[1..].iter().collect();
            assert_eq!(unique.len(), n, "seed={seed}: duplicates: {line}");
        }
    }

    #[test]
    fn prefix_count_zero_values_outputs_bare_zero() {
        // M10: n = 0 → the line is exactly `0`, no separator, no values
        let spec = parse_one(
            r#"{"n": {"type": "int", "min": 1, "max": 100, "count": {"min": 0, "max": 0}, "prefix_count": true}}"#,
        );
        let mut rng = seeded();
        assert_eq!(generate_one(&spec, &mut rng), "0");
    }

    #[test]
    fn zero_values_without_prefix_count_outputs_empty_line() {
        // M11: existing behavior preserved
        let spec = parse_one(
            r#"{"n": {"type": "int", "min": 1, "max": 100, "count": {"min": 0, "max": 0}}}"#,
        );
        let mut rng = seeded();
        assert_eq!(generate_one(&spec, &mut rng), "");
    }

    #[test]
    fn prefix_count_with_count_omitted() {
        // M12: omitted count ≡ {min: 1, max: 1, separator: " "} → `1 value`
        let spec = parse_one(
            r#"{"n": {"type": "int", "min": 42, "max": 42, "prefix_count": true}}"#,
        );
        let mut rng = seeded();
        assert_eq!(generate_one(&spec, &mut rng), "1 42");
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
                distinct: false,
                prefix_count: false,
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
                distinct: false,
                prefix_count: false,
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
                    distinct: false,
                    prefix_count: false,
                };
                let v = generate_one(&spec, &mut rng);
                assert!(!v.is_empty(), "faker {:?} should be non-empty", cat);
            }
        }
    }
}
