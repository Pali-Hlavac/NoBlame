//! The repository a job works on: opened from its path (trust checked like any open), where git
//! runs, and the located `git`.

use std::path::PathBuf;

use git_core::cli::Git;
use git_core::repo::{RepoKind, Repository};

use crate::git_env::GitEnvError;
use crate::repository::{RepositoryError, blocking};

/// An opened repository and where its jobs run git.
pub struct JobTarget {
    pub repo: Repository,
    /// The work tree, or the repository itself when bare.
    pub dir: PathBuf,
    pub git: Git,
}

impl JobTarget {
    /// Opens `path`; fails as opening it in a tab would (not a repository, untrusted).
    pub async fn open(path: &str) -> Result<Self, RepositoryError> {
        let path = PathBuf::from(path);
        let repo = blocking(move || Repository::discover(&path)).await??;
        let info = repo.info();
        let dir = match (&info.work_dir, info.kind) {
            (Some(work_dir), kind) if kind != RepoKind::Bare => work_dir.clone(),
            _ => info.git_dir.clone(),
        };
        let git = Git::locate().map_err(GitEnvError::from)?;
        Ok(Self { repo, dir, git })
    }

    /// The work tree; pulling needs one.
    pub fn work_tree(&self) -> Result<PathBuf, RepositoryError> {
        let info = self.repo.info();
        info.work_dir
            .clone()
            .filter(|_| info.kind != RepoKind::Bare)
            .ok_or(RepositoryError::Bare)
    }
}
