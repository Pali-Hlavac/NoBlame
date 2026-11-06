//! How many files are staged, changed, untracked or conflicted, and how many are new, changed
//! or deleted compared with `HEAD`.

/// Number of files in each state. A file that is staged and changed again counts in both.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct StatusSummary {
    /// Changes in the index (would go into the next commit).
    pub staged: u32,
    /// Tracked files changed in the working tree but not staged.
    pub unstaged: u32,
    /// Files git does not track and does not ignore.
    pub untracked: u32,
    /// Unmerged files (a merge, rebase or cherry-pick stopped on conflicts).
    pub conflicted: u32,
    /// The same files counted once each, by what happened to them since `HEAD`.
    pub changes: ChangeCounts,
}

impl StatusSummary {
    /// Nothing staged, changed, untracked or conflicted.
    pub fn is_clean(&self) -> bool {
        *self == Self::default()
    }
}

/// Uncommitted files counted once each, staged or not: what the Repositories module shows
/// beside a repository.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct ChangeCounts {
    /// New files: untracked, or added to the index.
    pub added: u32,
    /// Changed, renamed, copied or conflicted files.
    pub changed: u32,
    /// Files deleted from the index or the working tree.
    pub deleted: u32,
}

impl ChangeCounts {
    /// Counts a `1` or `2` record from its `XY` letters (index, working tree; `.` unchanged).
    pub(super) fn count_change(&mut self, index: u8, work_tree: u8) {
        if index == b'A' || work_tree == b'A' {
            self.added += 1;
        } else if index == b'D' || work_tree == b'D' {
            self.deleted += 1;
        } else {
            self.changed += 1;
        }
    }
}
