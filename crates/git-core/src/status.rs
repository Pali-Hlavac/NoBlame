//! Working tree status: how many files are staged, changed, untracked or conflicted.
//!
//! Read with `git status --porcelain=v2 -z` (read-only, `--no-optional-locks`) rather than gix,
//! because git honours the user's fsmonitor, untracked cache and `status.*` settings, which
//! matter most on huge working trees. Whether gix's status can match it is benchmarked in M4
//! (`docs/architecture/git-engine.md`). The file lists themselves arrive with M4.

use std::path::Path;

use tokio_util::sync::CancellationToken;

use crate::cli::{Git, GitError};

/// Failures while reading the status.
#[derive(Debug, thiserror::Error)]
pub enum StatusError {
    /// git could not run or failed.
    #[error(transparent)]
    Git(#[from] GitError),
    /// git printed something that is not porcelain v2.
    #[error("unexpected `git status` output: {0}")]
    Parse(String),
}

/// Number of files in each state. A file that is staged and changed again counts in both.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct StatusSummary {
    /// Changes in the index (would go into the next commit).
    pub staged: u32,
    /// Tracked files changed in the working tree but not staged.
    pub unstaged: u32,
    /// Files git does not track and does not ignore (directories count once, as git lists them).
    pub untracked: u32,
    /// Unmerged files (a merge, rebase or cherry-pick stopped on conflicts).
    pub conflicted: u32,
}

impl StatusSummary {
    /// Nothing staged, changed, untracked or conflicted.
    pub fn is_clean(&self) -> bool {
        *self == Self::default()
    }

    /// Counts the records of `git status --porcelain=v2 -z` output.
    pub fn parse(output: &[u8]) -> Result<Self, StatusError> {
        let mut summary = Self::default();
        let mut fields = output
            .split(|&byte| byte == 0)
            .filter(|field| !field.is_empty());
        while let Some(record) = fields.next() {
            match record.first() {
                Some(b'1') => summary.count_change(record)?,
                Some(b'2') => {
                    summary.count_change(record)?;
                    // A rename or copy is followed by its original path as a separate field.
                    fields.next();
                }
                Some(b'u') => summary.conflicted += 1,
                Some(b'?') => summary.untracked += 1,
                Some(b'!' | b'#') => {}
                _ => {
                    return Err(StatusError::Parse(
                        String::from_utf8_lossy(record).into_owned(),
                    ));
                }
            }
        }
        Ok(summary)
    }

    /// `1 XY ...` or `2 XY ...`: X is the index, Y the working tree, `.` means unchanged.
    fn count_change(&mut self, record: &[u8]) -> Result<(), StatusError> {
        let (Some(&index), Some(&work_tree)) = (record.get(2), record.get(3)) else {
            return Err(StatusError::Parse(
                String::from_utf8_lossy(record).into_owned(),
            ));
        };
        self.staged += u32::from(index != b'.');
        self.unstaged += u32::from(work_tree != b'.');
        Ok(())
    }
}

/// Reads the status summary of the working tree at `work_dir`.
pub async fn status_summary(
    git: &Git,
    work_dir: &Path,
    cancel: &CancellationToken,
) -> Result<StatusSummary, StatusError> {
    let output = git
        .command()
        .current_dir(work_dir)
        .read_only()
        .args(["status", "--porcelain=v2", "-z"])
        .run(cancel)
        .await?;
    StatusSummary::parse(&output.stdout)
}

#[cfg(test)]
mod tests {
    #![allow(clippy::unwrap_used)]
    use super::*;

    #[test]
    fn counts_each_kind_of_record() {
        let output = b"# branch.oid abc\0\
            1 M. N... 100644 100644 100644 a b staged.txt\0\
            1 .M N... 100644 100644 100644 a b changed.txt\0\
            1 MM N... 100644 100644 100644 a b both.txt\0\
            2 R. N... 100644 100644 100644 a b R100 new name.txt\0old name.txt\0\
            u UU N... 100644 100644 100644 100644 a b c conflict.txt\0\
            ? untracked/\0\
            ! ignored.log\0";
        let summary = StatusSummary::parse(output).unwrap();
        assert_eq!(
            summary,
            StatusSummary {
                staged: 3,
                unstaged: 2,
                untracked: 1,
                conflicted: 1
            }
        );
    }

    #[test]
    fn empty_output_is_clean() {
        assert!(StatusSummary::parse(b"").unwrap().is_clean());
    }

    #[test]
    fn rejects_other_formats() {
        assert!(StatusSummary::parse(b" M file.txt\0").is_err());
    }
}
