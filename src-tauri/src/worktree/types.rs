//! The working tree status as the UI sees it: counts for the rows at the top of the graph (or
//! the header), and the staged and unstaged files.

use git_core::status::{FileState, StatusFile, StatusSummary, WorkingTreeStatus};
use serde::{Deserialize, Serialize};
use specta::Type;

use super::ChangeCountsDto;
use crate::operations::OperationDto;

/// Number of files in each state; a file staged and changed again counts in both.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct StatusSummaryDto {
    /// Changes in the index.
    pub staged: u32,
    /// Tracked files changed in the working tree, not staged.
    pub unstaged: u32,
    /// Untracked files.
    pub untracked: u32,
    /// Files with merge conflicts.
    pub conflicted: u32,
    /// The same files counted once each: new, changed or deleted since `HEAD`.
    pub changes: ChangeCountsDto,
}

impl From<StatusSummary> for StatusSummaryDto {
    fn from(summary: StatusSummary) -> Self {
        Self {
            staged: summary.staged,
            unstaged: summary.unstaged,
            untracked: summary.untracked,
            conflicted: summary.conflicted,
            changes: summary.changes.into(),
        }
    }
}

/// What happened to a file on one side of the status.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum WorkingStatusDto {
    /// New file.
    Added,
    /// Removed.
    Deleted,
    /// Content, mode or type changed.
    Modified,
    /// Moved (`previousPath` is the old name).
    Renamed,
    /// Copied from `previousPath`.
    Copied,
    /// Not tracked by git.
    Untracked,
    /// Has merge conflicts.
    Conflicted,
}

/// One file of the status. Paths are for display (non-UTF-8 bytes are replaced).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct WorkingFileDto {
    /// Path in the working tree; ends in `/` for an untracked folder git does not look into.
    pub path: String,
    /// Old name of a rename or copy.
    pub previous_path: Option<String>,
    /// What happened to it.
    pub status: WorkingStatusDto,
    /// The blob it is compared with (hex): `HEAD`'s for staged files, the index's for changed
    /// ones, "ours" for conflicts; `null` when absent there.
    pub old_id: Option<String>,
    /// The staged blob (hex), for staged files; `null` otherwise.
    pub new_id: Option<String>,
    /// The new version is the file in the working tree (`get_worktree_file_id` names it).
    pub worktree: bool,
    /// A submodule pointer, not a file.
    pub submodule: bool,
}

impl From<StatusFile> for WorkingFileDto {
    fn from(file: StatusFile) -> Self {
        Self {
            path: file.display_path(),
            previous_path: file.display_previous_path(),
            status: match file.state {
                FileState::Added => WorkingStatusDto::Added,
                FileState::Deleted => WorkingStatusDto::Deleted,
                FileState::Modified => WorkingStatusDto::Modified,
                FileState::Renamed => WorkingStatusDto::Renamed,
                FileState::Copied => WorkingStatusDto::Copied,
                FileState::Untracked => WorkingStatusDto::Untracked,
                FileState::Conflicted => WorkingStatusDto::Conflicted,
            },
            old_id: file.old_id.map(|id| id.to_string()),
            new_id: file.new_id.map(|id| id.to_string()),
            worktree: file.in_worktree,
            submodule: file.submodule,
        }
    }
}

/// The working tree status: counts of everything, and the files (at most 5,000 on each side).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct WorkingTreeStatusDto {
    /// How many files are in each state.
    pub summary: StatusSummaryDto,
    /// Staged changes, sorted by path.
    pub staged: Vec<WorkingFileDto>,
    /// Changed, untracked and conflicted files, sorted by path.
    pub unstaged: Vec<WorkingFileDto>,
    /// The operation in progress (a merge stopped by conflicts, a rebase, ...), if any.
    pub operation: Option<OperationDto>,
}

impl WorkingTreeStatusDto {
    /// The status `git status` reported, with the operation in progress read beside it.
    pub(super) fn new(status: WorkingTreeStatus, operation: Option<OperationDto>) -> Self {
        Self {
            summary: status.summary.into(),
            staged: status.staged.into_iter().map(Into::into).collect(),
            unstaged: status.unstaged.into_iter().map(Into::into).collect(),
            operation,
        }
    }
}

/// A commit to make from the staged changes.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct CommitRequestDto {
    /// The message as typed (git applies `commit.cleanup`).
    pub message: String,
    /// Replace the last commit instead of adding one.
    pub amend: bool,
    /// Add a `Signed-off-by` trailer.
    pub sign_off: bool,
    /// Someone else as the author, written `Name <email>`; `null`: the configured author.
    pub author: Option<String>,
    /// Leave out comment lines: the message started from `commit.template`.
    pub strip_comments: bool,
}

/// What the message box needs before the user types: who commits, the template, the comment
/// character.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct CommitDefaultsDto {
    /// The configured author as `Name <email>`; `null` when no name or address is set.
    pub author: Option<String>,
    /// The configured `commit.template`, if any.
    pub template: Option<CommitTemplateDto>,
    /// The character starting comment lines (`core.commentChar`).
    pub comment_char: String,
}

/// The configured `commit.template`: its text, or why it could not be read.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct CommitTemplateDto {
    /// Where it is.
    pub path: String,
    /// Its text (lossy UTF-8); `null` when it could not be read.
    pub text: Option<String>,
    /// Why it could not be read.
    pub problem: Option<String>,
}

/// A commit that was made.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct CommitResultDto {
    /// What git and its hooks printed (git's summary line, hook messages).
    pub output: String,
}

/// Lines `start..=end` (1-based) of one version of a file.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct LineRangeDto {
    /// First line.
    pub start: u32,
    /// Last line (inclusive).
    pub end: u32,
}

/// Changed lines of one file to stage, unstage or discard, between the versions the diff
/// showed.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct LineChangeDto {
    /// Path in the working tree.
    pub path: String,
    /// The old version the diff showed (hex): the index's blob for working tree changes,
    /// HEAD's for staged ones; `null` when the file was not there.
    pub old_id: Option<String>,
    /// The new version the diff showed: the working tree file's id, or the staged blob.
    pub new_id: String,
    /// Removed lines, by their number in the old version (a range may include context).
    pub removed: Vec<LineRangeDto>,
    /// Added lines, by their number in the new version.
    pub added: Vec<LineRangeDto>,
}
