//! What a stash holds: the tracked files it changed (against the commit it was made on) and the
//! untracked files it saved (its third parent, a commit of only those files).

use gix::ObjectId;

use super::StashError;
use crate::diff::{ChangedFile, commit_changes};

/// The parent of a stash commit holding its untracked files (`--include-untracked`).
const UNTRACKED_PARENT: usize = 2;

/// The commits a stash is made of.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct StashCommits {
    /// The stash commit: the tracked files as they were stashed.
    pub id: ObjectId,
    /// The commit the stash was made on (its first parent).
    pub base: ObjectId,
    /// The commit of its untracked files (third parent), if it saved any.
    pub untracked: Option<ObjectId>,
}

/// The commits of the stash commit `id`.
pub fn stash_commits(repo: &gix::Repository, id: ObjectId) -> Result<StashCommits, StashError> {
    let commit = repo.find_commit(id).map_err(StashError::gix)?;
    let parents: Vec<ObjectId> = commit.parent_ids().map(gix::Id::detach).collect();
    let Some(&base) = parents.first() else {
        return Err(StashError::Gix(format!(
            "{id} is not a stash: it has no parent"
        )));
    };
    Ok(StashCommits {
        id,
        base,
        untracked: parents.get(UNTRACKED_PARENT).copied(),
    })
}

/// The files of one stash.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StashFiles {
    /// Its commits.
    pub commits: StashCommits,
    /// Tracked files it changed, against its base, sorted by path (at most 5,000).
    pub changed: Vec<ChangedFile>,
    /// All changed tracked files, including those not listed.
    pub changed_total: usize,
    /// Untracked files it saved, sorted by path (at most 5,000), each an addition.
    pub untracked: Vec<ChangedFile>,
    /// All untracked files, including those not listed.
    pub untracked_total: usize,
}

/// The files of the stash commit `id`.
pub fn stash_files(repo: &gix::Repository, id: ObjectId) -> Result<StashFiles, StashError> {
    let commits = stash_commits(repo, id)?;
    let changed = commit_changes(repo, id, 0)?;
    let untracked = match commits.untracked {
        Some(commit) => Some(commit_changes(repo, commit, 0)?),
        None => None,
    };
    Ok(StashFiles {
        commits,
        changed: changed.files,
        changed_total: changed.total,
        untracked_total: untracked.as_ref().map_or(0, |changes| changes.total),
        untracked: untracked.map(|changes| changes.files).unwrap_or_default(),
    })
}
