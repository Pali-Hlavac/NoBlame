//! A tiny deterministic random number generator (`SplitMix64`), so the same seed always
//! produces the same repository on every platform without extra dependencies.

/// `SplitMix64` state.
#[derive(Debug, Clone)]
pub struct Rng(u64);

/// Golden-ratio increment from the `SplitMix64` reference implementation.
const GAMMA: u64 = 0x9E37_79B9_7F4A_7C15;

impl Rng {
    /// Creates a generator from a seed.
    pub fn new(seed: u64) -> Self {
        Self(seed)
    }

    /// Next 64 random bits.
    pub fn next_u64(&mut self) -> u64 {
        self.0 = self.0.wrapping_add(GAMMA);
        let mut z = self.0;
        z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
        z ^ (z >> 31)
    }

    /// Uniform value in `0..bound` (`bound` must be > 0). The tiny modulo bias is irrelevant
    /// for generating test data.
    pub fn below(&mut self, bound: u32) -> u32 {
        // Truncation is intended: the result is < bound, which fits in u32.
        #[allow(clippy::cast_possible_truncation)]
        let value = (self.next_u64() % u64::from(bound.max(1))) as u32;
        value
    }

    /// True with probability `1 / n` (never when `n` is 0).
    pub fn one_in(&mut self, n: u32) -> bool {
        n != 0 && self.below(n) == 0
    }

    /// True with probability `percent / 100`.
    pub fn percent(&mut self, percent: u32) -> bool {
        self.below(100) < percent
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn is_deterministic() {
        let (mut a, mut b) = (Rng::new(7), Rng::new(7));
        for _ in 0..100 {
            assert_eq!(a.next_u64(), b.next_u64());
        }
    }

    #[test]
    fn below_stays_in_range() {
        let mut rng = Rng::new(1);
        assert!((0..1000).all(|_| rng.below(10) < 10));
        assert_eq!(rng.below(0), 0);
        assert!(!rng.one_in(0));
    }
}
