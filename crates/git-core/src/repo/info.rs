//! Facts about an opened repository: location, kind, HEAD, shallowness, commit-graph.

use std::path::PathBuf;

use super::RepoError;

/// How the repository is laid out on disk.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RepoKind {
    /// A repository with its own work tree.
    Normal,
    /// No work tree (`git clone --bare`).
    Bare,
    /// A work tree added with `git worktree add`.
    LinkedWorktree,
    /// A submodule checked out inside another repository.
    Submodule,
}

/// Where HEAD points.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Head {
    /// On a branch that has commits (short name, e.g. `main`).
    Branch(String),
    /// On a branch without commits yet (a new repository).
    Unborn(String),
    /// Detached at a commit (full hex id).
    Detached(String),
}

/// Everything the UI shows about a repository before reading its history.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RepoInfo {
    /// The work tree, or `None` for bare repositories.
    pub work_dir: Option<PathBuf>,
    /// The `.git` directory (or the repository itself when bare).
    pub git_dir: PathBuf,
    /// Layout on disk.
    pub kind: RepoKind,
    /// Where HEAD points.
    pub head: Head,
    /// Whether history was cut off by a shallow clone.
    pub is_shallow: bool,
    /// Whether a commit-graph file exists (it makes history loading much faster).
    pub has_commit_graph: bool,
}

impl RepoInfo {
    /// Reads the facts from an opened repository.
    pub(super) fn read(repo: &gix::Repository) -> Result<Self, RepoError> {
        let kind = if repo.is_bare() {
            RepoKind::Bare
        } else {
            match repo.kind() {
                gix::repository::Kind::Common => RepoKind::Normal,
                gix::repository::Kind::LinkedWorkTree => RepoKind::LinkedWorktree,
                gix::repository::Kind::Submodule => RepoKind::Submodule,
            }
        };
        Ok(Self {
            work_dir: repo.workdir().map(PathBuf::from),
            git_dir: repo.git_dir().to_path_buf(),
            kind,
            head: read_head(repo)?,
            is_shallow: repo.is_shallow().map_err(RepoError::gix)?,
            // A missing or unreadable commit-graph is not an error: history still loads.
            has_commit_graph: matches!(repo.commit_graph_if_enabled(), Ok(Some(_))),
        })
    }
}

fn read_head(repo: &gix::Repository) -> Result<Head, RepoError> {
    let head = repo.head().map_err(RepoError::gix)?;
    let branch = head.referent_name().map(|name| name.shorten().to_string());
    Ok(match (branch, head.id()) {
        (Some(name), Some(_)) => Head::Branch(name),
        (Some(name), None) => Head::Unborn(name),
        (None, Some(id)) => Head::Detached(id.to_string()),
        // Not reachable in practice: a HEAD that is neither symbolic nor a commit.
        (None, None) => Head::Unborn(String::from("HEAD")),
    })
}
