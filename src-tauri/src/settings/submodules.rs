//! Submodule preferences: whether fetches include the submodules, and whether pull and checkout
//! move them to the commits the repository records.

use serde::{Deserialize, Serialize};
use specta::Type;

/// How submodules follow the repository they are in.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase", default)]
pub struct SubmoduleSettings {
    /// Fetch also fetches every submodule (`--recurse-submodules`). On by default; off leaves
    /// it to git (`fetch.recurseSubmodules`, by default only when new pointers arrive).
    pub fetch_submodules: bool,
    /// After a pull or a checkout, the submodules are updated to the commits the repository now
    /// records (`git pull --recurse-submodules`, `git submodule update`). Off by default: a bar
    /// offers it instead.
    pub update_after_pull_and_checkout: bool,
}

impl Default for SubmoduleSettings {
    fn default() -> Self {
        Self {
            fetch_submodules: true,
            update_after_pull_and_checkout: false,
        }
    }
}

#[cfg(test)]
mod tests {
    #![allow(clippy::unwrap_used)]
    use super::*;

    #[test]
    fn missing_fields_take_the_defaults() {
        let settings: SubmoduleSettings =
            serde_json::from_str(r#"{ "updateAfterPullAndCheckout": true }"#).unwrap();
        assert!(settings.fetch_submodules);
        assert!(settings.update_after_pull_and_checkout);
    }
}
