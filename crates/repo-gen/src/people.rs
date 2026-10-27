//! Deterministic authors, including non-ASCII names, so parsers meet real-world identities.

use crate::history::len;
use crate::rng::Rng;
use crate::stream::Signature;

const FIRST_NAMES: &[&str] = &[
    "Ada", "Linus", "Grace", "Jürgen", "Zoë", "Ana", "Mateo", "Wei",
];
const LAST_NAMES: &[&str] = &[
    "Lovelace", "Hopper", "Müller", "Novák", "Silva", "Rossi", "Li",
];

/// An owned author identity with a timestamp.
pub(crate) struct OwnedSignature {
    name: String,
    email: String,
    time: u64,
}

impl OwnedSignature {
    /// Borrows the identity in the form the stream writer takes.
    pub(crate) fn as_signature(&self) -> Signature<'_> {
        Signature {
            name: &self.name,
            email: &self.email,
            time: self.time,
        }
    }
}

/// A random author from the fixed list, at `time`.
pub(crate) fn signature(rng: &mut Rng, time: u64) -> OwnedSignature {
    let first = rng.below(len(FIRST_NAMES)) as usize;
    let last = rng.below(len(LAST_NAMES)) as usize;
    OwnedSignature {
        name: format!("{} {}", FIRST_NAMES[first], LAST_NAMES[last]),
        email: format!("dev{first}{last}@example.com"),
        time,
    }
}
