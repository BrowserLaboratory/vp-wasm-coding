//! Advisory quality checks (requirement Part II: Q1 order, Q2 uniformity,
//! Q3 performance). These are implementation-local smoke tests; the RNG seeds
//! are self-held by this implementation (Part II contract) and changing them
//! is a reviewed test change.

use rand::SeedableRng;
use rand::rngs::SmallRng;
use random_input_generator::generate;

/// Self-held seed for the statistical smoke tests.
const QUALITY_SEED: u64 = 20260726;

fn lines_for(params_json: &str, n_lines: usize, rng: &mut SmallRng) -> Vec<String> {
    generate(params_json, n_lines, rng).expect("valid params")
}

fn fully_sorted_counts(lines: &[String]) -> (usize, usize) {
    let mut ascending = 0;
    let mut descending = 0;
    for line in lines {
        let values: Vec<i64> = line.split(' ').map(|t| t.parse().unwrap()).collect();
        if values.windows(2).all(|w| w[0] < w[1]) {
            ascending += 1;
        }
        if values.windows(2).all(|w| w[0] > w[1]) {
            descending += 1;
        }
    }
    (ascending, descending)
}

/// Q1 (primary): n = 10, domain [1, 10^6], 1000 lines with a fixed seed.
/// Fully ascending / fully descending lines must each stay <= 10 — the random
/// expectation is ~0.0003 lines, so the threshold only catches systematic
/// sorting leaked from the sampling implementation.
#[test]
fn q1_output_order_not_systematically_sorted_primary() {
    let mut rng = SmallRng::seed_from_u64(QUALITY_SEED);
    let lines = lines_for(
        r#"{"n": {"type": "int", "min": 1, "max": 1000000, "count": {"min": 10, "max": 10}, "distinct": true}}"#,
        1000,
        &mut rng,
    );
    let (asc, desc) = fully_sorted_counts(&lines);
    assert!(asc <= 10, "systematic ascending order: {asc}/1000 lines fully ascending");
    assert!(desc <= 10, "systematic descending order: {desc}/1000 lines fully descending");
}

/// Q1 (secondary): n = 20, domain [1, 100] — guards against "only unsorted for
/// certain parameters" (this hits the materialise-and-shuffle path).
#[test]
fn q1_output_order_not_systematically_sorted_secondary() {
    let mut rng = SmallRng::seed_from_u64(QUALITY_SEED + 1);
    let lines = lines_for(
        r#"{"n": {"type": "int", "min": 1, "max": 100, "count": {"min": 20, "max": 20}, "distinct": true}}"#,
        1000,
        &mut rng,
    );
    let (asc, desc) = fully_sorted_counts(&lines);
    assert!(asc <= 10, "systematic ascending order: {asc}/1000 lines fully ascending");
    assert!(desc <= 10, "systematic descending order: {desc}/1000 lines fully descending");
}

/// Q2: value-selection uniformity. min=1, max=20, count 10, fixed seed, 10^4
/// lines. Chi-squared over the 20 per-value totals: E = 5000, df = 19,
/// alpha = 0.001 → critical value 43.82. Without-replacement sampling makes the
/// counts negatively correlated (variance below the independent multinomial
/// model), so the standard critical value is conservative — no correction.
#[test]
fn q2_value_selection_uniformity_chi_squared() {
    let mut rng = SmallRng::seed_from_u64(QUALITY_SEED + 2);
    let lines = lines_for(
        r#"{"n": {"type": "int", "min": 1, "max": 20, "count": {"min": 10, "max": 10}, "distinct": true}}"#,
        10_000,
        &mut rng,
    );
    let mut observed = [0u64; 20];
    for line in &lines {
        for t in line.split(' ') {
            let v: usize = t.parse().unwrap();
            observed[v - 1] += 1;
        }
    }
    let expected = 5000.0_f64;
    let chi_squared: f64 = observed
        .iter()
        .map(|&o| {
            let d = o as f64 - expected;
            d * d / expected
        })
        .sum();
    assert!(
        chi_squared < 43.82,
        "chi-squared {chi_squared:.2} >= 43.82 (df=19, alpha=0.001): selection is not uniform"
    );
}

/// Q3: performance reference (measured on native release builds — the
/// documented reference environment for this implementation). Debug builds
/// skip: unoptimised timings would only produce false alarms.
#[cfg(not(debug_assertions))]
mod q3_performance {
    use super::*;
    use std::time::Instant;

    fn assert_single_line_under_100ms(params_json: &str, label: &str) {
        let mut rng = SmallRng::seed_from_u64(QUALITY_SEED + 3);
        // Warm-up draw, then measure a single line (parse cost included —
        // negligible against 10^4 samples, and conservative for the budget).
        let _ = generate(params_json, 1, &mut rng).expect("valid params");
        let start = Instant::now();
        let line = &generate(params_json, 1, &mut rng).expect("valid params")[0];
        let elapsed = start.elapsed();
        assert!(!line.is_empty());
        assert!(
            elapsed.as_millis() < 100,
            "{label}: single line took {elapsed:?} (budget 100 ms)"
        );
    }

    /// Q3a: count.max = 10^4 from a huge domain [1, 10^9] (rejection path).
    #[test]
    fn q3_huge_domain_single_line_under_100ms() {
        assert_single_line_under_100ms(
            r#"{"n": {"type": "int", "min": 1, "max": 1000000000, "count": {"min": 10000, "max": 10000}, "distinct": true}}"#,
            "huge domain [1, 1e9], n = 1e4",
        );
    }

    /// Q3b: domain [1, 10^4] fully taken (permutation / shuffle path).
    #[test]
    fn q3_full_domain_permutation_under_100ms() {
        assert_single_line_under_100ms(
            r#"{"n": {"type": "int", "min": 1, "max": 10000, "count": {"min": 10000, "max": 10000}, "distinct": true}}"#,
            "permutation of [1, 1e4]",
        );
    }
}
