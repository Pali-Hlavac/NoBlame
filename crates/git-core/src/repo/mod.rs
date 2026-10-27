//! Opening repositories with `gix` and describing what was opened.
//!
//! Discovery walks up from the given path like `git` does. Repositories that git would refuse
//! (owned by another user and not listed in `safe.directory`) are refused too, with a reason.

mod error;
mod info;

use std::path::Path;

pub use error::RepoError;
pub use info::{Head, RepoInfo, RepoKind};

/// A repository opened for reading. Cheap to clone and safe to share between threads; call
/// [`Repository::local`] to get a `gix::Repository` for the current thread.
#[derive(Clone)]
pub struct Repository {
    inner: gix::ThreadSafeRepository,
    info: RepoInfo,
}

impl std::fmt::Debug for Repository {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Repository")
            .field("info", &self.info)
            .finish_non_exhaustive()
    }
}

impl Repository {
    /// Finds the repository containing `path` (searching upwards) and opens it.
    pub fn discover(path: &Path) -> Result<Self, RepoError> {
        let trust = gix::sec::trust::Mapping {
            full: gix::open::Options::default(),
            // Like git: a repository that is not ours and not in `safe.directory` is refused.
            reduced: gix::open::Options::default().bail_if_untrusted(true),
        };
        let inner = gix::ThreadSafeRepository::discover_opts(
            path,
            gix::discover::upwards::Options::default(),
            trust,
        )
        .map_err(|error| RepoError::from_discover(path, &error))?;
        let info = RepoInfo::read(&inner.to_thread_local())?;
        Ok(Self { inner, info })
    }

    /// What was opened.
    pub fn info(&self) -> &RepoInfo {
        &self.info
    }

    /// A handle for the current thread. Creating one is cheap (no file access).
    pub fn local(&self) -> gix::Repository {
        self.inner.to_thread_local()
    }

    /// Re-reads HEAD and the other facts in [`RepoInfo`] (after commits, checkouts, ...).
    pub fn refresh_info(&mut self) -> Result<&RepoInfo, RepoError> {
        self.info = RepoInfo::read(&self.local())?;
        Ok(&self.info)
    }
}
