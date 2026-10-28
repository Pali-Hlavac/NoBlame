//! The files a commit changed, for the Changed files module.

use git_core::diff::{ChangeStatus, ChangedFile, CommitChanges};
use serde::Serialize;
use specta::Type;

/// How a file changed.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum ChangeStatusDto {
    /// New file.
    Added,
    /// Removed file.
    Deleted,
    /// Content or mode changed.
    Modified,
    /// Moved (`previousPath` is the old name).
    Renamed,
    /// Copied from `previousPath`.
    Copied,
}

/// One changed file. Paths are for display (non-UTF-8 bytes are replaced); the blob ids
/// identify the contents without a round trip through the path.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ChangedFileDto {
    /// Path after the change (before it, for deletions).
    pub path: String,
    /// Old path of a rename or copy.
    pub previous_path: Option<String>,
    /// How it changed.
    pub status: ChangeStatusDto,
    /// Blob before the change (hex); `null` when added.
    pub old_id: Option<String>,
    /// Blob after the change (hex); `null` when deleted.
    pub new_id: Option<String>,
    /// A submodule pointer, not a file.
    pub submodule: bool,
}

/// The changed files of one commit against one parent.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ChangedFilesDto {
    /// Sorted by path, at most 5,000.
    pub files: Vec<ChangedFileDto>,
    /// All changed files, including those not listed.
    pub total: u32,
    /// Parents of the commit (more than one for a merge; 0 for the first commit).
    pub parent_count: u32,
}

impl From<ChangedFile> for ChangedFileDto {
    fn from(file: ChangedFile) -> Self {
        Self {
            path: file.display_path(),
            previous_path: file.previous_path.map(|path| path.to_string()),
            status: match file.status {
                ChangeStatus::Added => ChangeStatusDto::Added,
                ChangeStatus::Deleted => ChangeStatusDto::Deleted,
                ChangeStatus::Modified => ChangeStatusDto::Modified,
                ChangeStatus::Renamed => ChangeStatusDto::Renamed,
                ChangeStatus::Copied => ChangeStatusDto::Copied,
            },
            old_id: file.old_id.map(|id| id.to_string()),
            new_id: file.new_id.map(|id| id.to_string()),
            submodule: file.submodule,
        }
    }
}

impl From<CommitChanges> for ChangedFilesDto {
    fn from(changes: CommitChanges) -> Self {
        Self {
            files: changes
                .files
                .into_iter()
                .map(ChangedFileDto::from)
                .collect(),
            total: u32::try_from(changes.total).unwrap_or(u32::MAX),
            parent_count: u32::try_from(changes.parent_count).unwrap_or(u32::MAX),
        }
    }
}
