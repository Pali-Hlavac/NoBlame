//! Uncommitted files counted once each as new, changed or deleted: the numbers beside a
//! repository in the Repositories module.

use git_core::status::ChangeCounts;
use serde::Serialize;
use specta::Type;

/// Uncommitted files counted once each, staged or not (the Repositories module's counts).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ChangeCountsDto {
    /// New files: untracked or added.
    pub added: u32,
    /// Changed, renamed, copied or conflicted files.
    pub changed: u32,
    /// Deleted files.
    pub deleted: u32,
}

impl From<ChangeCounts> for ChangeCountsDto {
    fn from(counts: ChangeCounts) -> Self {
        Self {
            added: counts.added,
            changed: counts.changed,
            deleted: counts.deleted,
        }
    }
}
