//! Update preferences (ADR 0017): whether NoBlame looks for a new release when it starts.

use serde::{Deserialize, Serialize};
use specta::Type;

/// How NoBlame looks for updates (only builds that update themselves do).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase", default)]
pub struct UpdateSettings {
    /// Ask the release feed for a newer version once after starting. Nothing is installed
    /// without the user's go-ahead.
    pub check_on_start: bool,
}

impl Default for UpdateSettings {
    fn default() -> Self {
        Self {
            check_on_start: true,
        }
    }
}
