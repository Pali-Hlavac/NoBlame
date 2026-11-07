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
    /// Where it fetches from, as configured (for editing).
    pub url: Option<String>,
    /// Where it pushes to when that differs, as configured.
    pub push_url: Option<String>,
    /// `url` with any password written into it hidden (`***`), for showing.
    pub shown_url: Option<String>,
    /// `push_url`, hidden the same way.
    pub shown_push_url: Option<String>,
    /// URLs beyond the first of each kind (edited in a terminal).
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
            url: info.url,
            push_url: info.push_url,
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

/// A remote's new name and URLs; what did not change is left alone.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct EditRemoteRequestDto {
    /// Its name now.
    pub name: String,
    /// Its name after (the same to keep it).
    pub new_name: String,
    /// Where it fetches from.
    pub url: String,
    /// Where it pushes to; `None` (or empty) pushes where it fetches from.
    pub push_url: Option<String>,
}
