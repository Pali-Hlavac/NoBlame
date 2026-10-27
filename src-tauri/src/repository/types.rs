//! Repository data shared with the frontend.

use git_core::repo::{Head, RepoInfo, RepoKind};
use serde::Serialize;
use specta::Type;

/// Identifies an open repository session in later commands.
pub type RepoId = u32;

/// How the repository is laid out on disk.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum RepoKindDto {
    /// Has its own work tree.
    Normal,
    /// No work tree.
    Bare,
    /// Added with `git worktree add`.
    LinkedWorktree,
    /// A submodule.
    Submodule,
}

/// Where HEAD points.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum HeadDto {
    /// On a branch with commits.
    Branch {
        /// Short branch name.
        name: String,
    },
    /// On a branch without commits yet.
    Unborn {
        /// Short branch name.
        name: String,
    },
    /// Detached at a commit.
    Detached {
        /// Full commit id.
        id: String,
    },
}

/// An open repository.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct RepoSummary {
    /// Session id for later commands.
    pub id: RepoId,
    /// Folder name, for tabs.
    pub name: String,
    /// Work tree, or the repository itself when bare.
    pub path: String,
    /// The `.git` directory.
    pub git_dir: String,
    /// Layout on disk.
    pub kind: RepoKindDto,
    /// Where HEAD points.
    pub head: HeadDto,
    /// History cut off by a shallow clone.
    pub is_shallow: bool,
    /// A commit-graph file exists.
    pub has_commit_graph: bool,
}

impl RepoSummary {
    /// Builds the summary of session `id`.
    pub fn new(id: RepoId, info: &RepoInfo) -> Self {
        let root = info.work_dir.as_deref().unwrap_or(&info.git_dir);
        Self {
            id,
            name: root.file_name().map_or_else(
                || root.display().to_string(),
                |name| name.to_string_lossy().into_owned(),
            ),
            path: root.display().to_string(),
            git_dir: info.git_dir.display().to_string(),
            kind: match info.kind {
                RepoKind::Normal => RepoKindDto::Normal,
                RepoKind::Bare => RepoKindDto::Bare,
                RepoKind::LinkedWorktree => RepoKindDto::LinkedWorktree,
                RepoKind::Submodule => RepoKindDto::Submodule,
            },
            head: match &info.head {
                Head::Branch(name) => HeadDto::Branch { name: name.clone() },
                Head::Unborn(name) => HeadDto::Unborn { name: name.clone() },
                Head::Detached(id) => HeadDto::Detached { id: id.clone() },
            },
            is_shallow: info.is_shallow,
            has_commit_graph: info.has_commit_graph,
        }
    }
}
