//! How many files are staged, changed, untracked or conflicted.

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
}

impl StatusSummary {
    /// Nothing staged, changed, untracked or conflicted.
    pub fn is_clean(&self) -> bool {
        *self == Self::default()
    }
}
