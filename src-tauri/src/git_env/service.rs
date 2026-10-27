//! Locating git and checking its version.

use std::time::Duration;

use git_core::cli::{Git, GitVersion, MIN_GIT_VERSION};
use serde::Serialize;
use specta::Type;
use tokio_util::sync::CancellationToken;

use super::GitEnvError;

/// How long `git --version` may take. A healthy git answers in milliseconds; the macOS shim
/// without Command Line Tools can hang while it shows its install dialog.
const VERSION_TIMEOUT: Duration = Duration::from_secs(10);

/// The git executable NoBlame will run, shown in the status bar and About dialog.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct GitInfo {
    /// Absolute path of the executable (for display).
    pub path: String,
    /// Detected version, e.g. `2.47.1`.
    pub version: String,
    /// Whether the version is at least [`minimum_version`](Self::minimum_version).
    pub supported: bool,
    /// Oldest version NoBlame supports.
    pub minimum_version: String,
}

impl GitInfo {
    fn new(git: &Git, version: GitVersion) -> Self {
        Self {
            path: git.program().display().to_string(),
            version: version.to_string(),
            supported: version.is_supported(),
            minimum_version: MIN_GIT_VERSION.to_string(),
        }
    }
}

/// Locates git (again, so a fresh install is picked up) and asks for its version.
pub async fn probe() -> Result<GitInfo, GitEnvError> {
    let git = Git::locate()?;
    let cancel = CancellationToken::new();
    // Dropping the timed-out future kills the process.
    let version = tokio::time::timeout(VERSION_TIMEOUT, git.version(&cancel))
        .await
        .map_err(|_| GitEnvError::Timeout(VERSION_TIMEOUT))??;
    let info = GitInfo::new(&git, version);
    tracing::info!(path = %info.path, version = %info.version, "found git");
    Ok(info)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn flags_versions_below_the_minimum() {
        let git = Git::at("git");
        assert!(GitInfo::new(&git, MIN_GIT_VERSION).supported);
        let old = GitInfo::new(&git, GitVersion::new(2, 20, 1));
        assert!(!old.supported);
        assert_eq!(old.version, "2.20.1");
        assert_eq!(old.minimum_version, MIN_GIT_VERSION.to_string());
    }
}
