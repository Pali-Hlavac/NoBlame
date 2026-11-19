//! What the remote management commands take and return.

use git_core::remote::{RemoteInfo, redact_credentials};
use serde::{Deserialize, Serialize};
use specta::Type;

/// A remote as the Remotes dialog shows it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct RemoteDto {
    /// Its name (`origin`).
    pub name: String,
    /// Where it fetches from, a password written into it hidden (`***`).
    pub shown_url: Option<String>,
    /// Where it pushes to when that differs, hidden the same way.
    pub shown_push_url: Option<String>,
    /// URLs beyond the first of each kind (the editor's General tab lists them).
    pub extra_urls: u32,
    /// Its remote branches here.
    pub branches: u32,
    /// Local branches whose upstream is on it.
    pub tracked_by: Vec<String>,
}

impl From<RemoteInfo> for RemoteDto {
    fn from(info: RemoteInfo) -> Self {
        let count = |n: usize| u32::try_from(n).unwrap_or(u32::MAX);
        Self {
            shown_url: info.url.as_deref().map(redact_credentials),
            shown_push_url: info.push_url.as_deref().map(redact_credentials),
            name: info.name,
            extra_urls: count(info.extra_urls),
            branches: count(info.branches),
            tracked_by: info.tracked_by,
        }
    }
}

/// A remote to add.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct AddRemoteRequestDto {
    pub name: String,
    pub url: String,
}
