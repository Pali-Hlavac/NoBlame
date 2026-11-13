//! Commit module preferences: how its lists show files.

use serde::{Deserialize, Serialize};
use specta::Type;

/// Commit module preferences.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase", default)]
pub struct CommitSettings {
    /// How the Changes and Staged lists show each file.
    pub file_display: FileDisplay,
}

/// How a list shows a file's name and folder.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum FileDisplay {
    /// The name, then its folder greyed; in git's order.
    #[default]
    NameFirst,
    /// The folder greyed, then the name; sorted by the whole path, folder by folder.
    PathFirst,
}

#[cfg(test)]
mod tests {
    #![allow(clippy::unwrap_used)]
    use super::*;

    #[test]
    fn file_display_reads_and_defaults() {
        let settings: CommitSettings =
            serde_json::from_str(r#"{ "fileDisplay": "pathFirst" }"#).unwrap();
        assert_eq!(settings.file_display, FileDisplay::PathFirst);
        let settings: CommitSettings = serde_json::from_str("{}").unwrap();
        assert_eq!(settings.file_display, FileDisplay::NameFirst);
    }
}
