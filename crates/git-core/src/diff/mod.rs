//! What a commit changed: the list of files (this module) and, later, their line diffs.
//! Tree diffs run in-process with gix, renames detected as `git` would (`diff.renames`).

use gix::ObjectId;
use gix::bstr::{BString, ByteSlice};
use gix::object::tree::diff::ChangeDetached;

/// Files returned at most for one commit; a vendor import can touch hundreds of thousands.
pub const MAX_CHANGED_FILES: usize = 5_000;

/// Failures while diffing.
#[derive(Debug, thiserror::Error)]
pub enum DiffError {
    /// gix could not read or diff the objects.
    #[error("{0}")]
    Gix(String),
    /// The commit has fewer parents than asked for.
    #[error("the commit has no parent number {0}")]
    NoSuchParent(usize),
}

impl DiffError {
    fn gix(error: impl std::fmt::Display) -> Self {
        Self::Gix(error.to_string())
    }
}

/// How a file changed.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ChangeStatus {
    /// New file.
    Added,
    /// Removed file.
    Deleted,
    /// Content or mode changed.
    Modified,
    /// Moved, possibly with changes (`previous_path` holds the old name).
    Renamed,
    /// Copied from `previous_path`.
    Copied,
}

/// One changed file.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ChangedFile {
    /// Path in the new tree (in the old tree for deletions). Bytes: may be non-UTF-8.
    pub path: BString,
    /// Old path of a rename or copy.
    pub previous_path: Option<BString>,
    /// How it changed.
    pub status: ChangeStatus,
    /// Blob before the change; `None` when added.
    pub old_id: Option<ObjectId>,
    /// Blob after the change; `None` when deleted.
    pub new_id: Option<ObjectId>,
    /// The entry is a submodule (a commit pointer), not a file.
    pub submodule: bool,
}

/// The files a commit changed against one of its parents.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CommitChanges {
    /// Sorted by path; at most [`MAX_CHANGED_FILES`].
    pub files: Vec<ChangedFile>,
    /// All changed files, including those not listed.
    pub total: usize,
    /// Number of parents the commit has (0 for a root commit).
    pub parent_count: usize,
}

/// The changes of `commit` against its parent number `parent` (0 = first parent), or against
/// the empty tree for a root commit.
pub fn commit_changes(
    repo: &gix::Repository,
    commit: ObjectId,
    parent: usize,
) -> Result<CommitChanges, DiffError> {
    let commit = repo.find_commit(commit).map_err(DiffError::gix)?;
    let parents: Vec<ObjectId> = commit.parent_ids().map(gix::Id::detach).collect();
    let new_tree = commit.tree().map_err(DiffError::gix)?;
    let old_tree = match parents.get(parent) {
        Some(id) => Some(
            repo.find_commit(*id)
                .and_then(|parent| parent.tree())
                .map_err(DiffError::gix)?,
        ),
        None if parents.is_empty() => None,
        None => return Err(DiffError::NoSuchParent(parent)),
    };
    let changes = repo
        .diff_tree_to_tree(old_tree.as_ref(), Some(&new_tree), None)
        .map_err(DiffError::gix)?;
    let mut files: Vec<ChangedFile> = changes.into_iter().filter_map(changed_file).collect();
    files.sort_by(|a, b| a.path.cmp(&b.path));
    let total = files.len();
    files.truncate(MAX_CHANGED_FILES);
    Ok(CommitChanges {
        files,
        total,
        parent_count: parents.len(),
    })
}

/// Converts one gix change; folders (trees) are skipped, their files are listed instead.
fn changed_file(change: ChangeDetached) -> Option<ChangedFile> {
    let file = match change {
        ChangeDetached::Addition {
            location,
            entry_mode,
            id,
            ..
        } => ChangedFile {
            path: location,
            previous_path: None,
            status: ChangeStatus::Added,
            old_id: None,
            new_id: Some(id),
            submodule: entry_mode.is_commit(),
        }
        .unless(entry_mode.is_tree())?,
        ChangeDetached::Deletion {
            location,
            entry_mode,
            id,
            ..
        } => ChangedFile {
            path: location,
            previous_path: None,
            status: ChangeStatus::Deleted,
            old_id: Some(id),
            new_id: None,
            submodule: entry_mode.is_commit(),
        }
        .unless(entry_mode.is_tree())?,
        ChangeDetached::Modification {
            location,
            previous_id,
            entry_mode,
            id,
            ..
        } => ChangedFile {
            path: location,
            previous_path: None,
            status: ChangeStatus::Modified,
            old_id: Some(previous_id),
            new_id: Some(id),
            submodule: entry_mode.is_commit(),
        }
        .unless(entry_mode.is_tree())?,
        ChangeDetached::Rewrite {
            source_location,
            source_id,
            entry_mode,
            id,
            location,
            copy,
            ..
        } => ChangedFile {
            path: location,
            previous_path: Some(source_location),
            status: if copy {
                ChangeStatus::Copied
            } else {
                ChangeStatus::Renamed
            },
            old_id: Some(source_id),
            new_id: Some(id),
            submodule: entry_mode.is_commit(),
        }
        .unless(entry_mode.is_tree())?,
    };
    Some(file)
}

impl ChangedFile {
    fn unless(self, skip: bool) -> Option<Self> {
        (!skip).then_some(self)
    }

    /// The path for display (lossy for non-UTF-8 bytes).
    pub fn display_path(&self) -> String {
        self.path.to_str_lossy().into_owned()
    }
}
