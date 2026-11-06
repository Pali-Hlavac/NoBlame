//! What the branch and tag commands take and return.

use git_core::branch::{RefNamespace, UniqueCommits};
use serde::{Deserialize, Serialize};
use specta::Type;

/// Where a reference lives.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum RefNamespaceDto {
    /// A local branch (`refs/heads/`).
    Branch,
    /// A tag (`refs/tags/`).
    Tag,
    /// A remote branch (`refs/remotes/`, the name includes the remote).
    Remote,
}

impl From<RefNamespaceDto> for RefNamespace {
    fn from(namespace: RefNamespaceDto) -> Self {
        match namespace {
            RefNamespaceDto::Branch => Self::Branch,
            RefNamespaceDto::Tag => Self::Tag,
            RefNamespaceDto::Remote => Self::Remote,
        }
    }
}

/// A branch or tag as the user saw it: checked to still point at `target` before it changes.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct RefTargetDto {
    /// Branch, tag or remote branch.
    pub namespace: RefNamespaceDto,
    /// Short name (`main`, `v1.0`, `origin/main`).
    pub name: String,
    /// Full id of the commit it pointed to (annotated tags peeled).
    pub target: String,
}

/// A branch to create.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct CreateBranchRequestDto {
    /// Its name.
    pub name: String,
    /// Where it starts: a commit id, or a branch, remote branch or tag name.
    pub start: String,
    /// Check it out afterwards.
    pub checkout: bool,
    /// Make `start` (a remote branch) its upstream.
    pub track: bool,
}

/// A branch to rename.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct RenameBranchRequestDto {
    /// The branch, as the user saw it.
    pub branch: RefTargetDto,
    /// Its new name.
    pub new_name: String,
}

/// A tag to create.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct CreateTagRequestDto {
    /// Its name.
    pub name: String,
    /// The commit it marks (an id or a name).
    pub target: String,
    /// With a message the tag is annotated; empty or `null` makes a lightweight tag.
    pub message: Option<String>,
}

/// One commit by id and subject.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct CommitLineDto {
    /// Full id (hex).
    pub id: String,
    /// The message's first line.
    pub summary: String,
}

/// The commits only one branch or tag holds: what deleting it leaves unreachable.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct UniqueCommitsDto {
    /// How many.
    pub count: u32,
    /// The newest few, newest first.
    pub newest: Vec<CommitLineDto>,
}

impl From<UniqueCommits> for UniqueCommitsDto {
    fn from(unique: UniqueCommits) -> Self {
        Self {
            count: unique.count,
            newest: unique
                .newest
                .into_iter()
                .map(|(id, summary)| CommitLineDto { id, summary })
                .collect(),
        }
    }
}
