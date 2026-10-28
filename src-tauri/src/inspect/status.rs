//! The working tree status summary shown as rows at the top of the graph (or in the header).

use git_core::status::StatusSummary;
use serde::Serialize;
use specta::Type;

/// Number of files in each state; a file staged and changed again counts in both.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct StatusSummaryDto {
    /// Changes in the index.
    pub staged: u32,
    /// Tracked files changed in the working tree, not staged.
    pub unstaged: u32,
    /// Untracked files (an untracked folder counts once).
    pub untracked: u32,
    /// Files with merge conflicts.
    pub conflicted: u32,
}

impl From<StatusSummary> for StatusSummaryDto {
    fn from(summary: StatusSummary) -> Self {
        Self {
            staged: summary.staged,
            unstaged: summary.unstaged,
            untracked: summary.untracked,
            conflicted: summary.conflicted,
        }
    }
}
