//! Working tree status: the staged files, the changed, untracked and conflicted ones, and how
//! many there are of each.
//!
//! Read with `git status --porcelain=v2 -z` (read-only, `--no-optional-locks`) rather than gix,
//! because git honours the user's fsmonitor, untracked cache and `status.*` settings, which
//! matter most on huge working trees (`docs/architecture/git-engine.md`).

mod parse;
mod summary;

use std::path::Path;

use gix::ObjectId;
use gix::bstr::{BString, ByteSlice};
use tokio_util::sync::CancellationToken;

use crate::cli::{Git, GitError};

pub use summary::{ChangeCounts, StatusSummary};

/// Files listed at most in each list; the summary still counts them all.
pub const MAX_STATUS_FILES: usize = 5_000;

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

/// What happened to a file, on one side of the status (staged, or in the working tree).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FileState {
    /// New file (staged), or a file added with `git add --intent-to-add`.
    Added,
    /// Removed.
    Deleted,
    /// Content, mode or type changed.
    Modified,
    /// Moved (`previous_path` holds the old name).
    Renamed,
    /// Copied from `previous_path`.
    Copied,
    /// Not tracked and not ignored.
    Untracked,
    /// Unmerged: a merge, rebase or cherry-pick stopped on a conflict here.
    Conflicted,
}

/// One file in the status.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StatusFile {
    /// Path in the working tree. Bytes: may be non-UTF-8. Ends in `/` for an untracked folder
    /// git does not look into (a repository inside this one).
    pub path: BString,
    /// The old name of a rename or copy.
    pub previous_path: Option<BString>,
    /// What happened to it.
    pub state: FileState,
    /// The version it is compared with: the `HEAD` blob for staged files, the index blob for
    /// changed ones, "ours" for conflicts. `None` when absent there.
    pub old_id: Option<ObjectId>,
    /// The staged blob, for staged files; `None` for working tree files and deletions.
    pub new_id: Option<ObjectId>,
    /// The new version is the file in the working tree (it is not deleted there).
    pub in_worktree: bool,
    /// The entry is a submodule (a commit pointer), not a file.
    pub submodule: bool,
}

impl StatusFile {
    /// The path for display (lossy for non-UTF-8 bytes).
    pub fn display_path(&self) -> String {
        self.path.to_str_lossy().into_owned()
    }

    /// The old name for display, if renamed or copied.
    pub fn display_previous_path(&self) -> Option<String> {
        self.previous_path
            .as_ref()
            .map(|path| path.to_str_lossy().into_owned())
    }
}

/// The working tree status: counts, and the files on each side, sorted by path.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct WorkingTreeStatus {
    /// How many files are in each state (all of them, also those not listed).
    pub summary: StatusSummary,
    /// Changes in the index; at most [`MAX_STATUS_FILES`].
    pub staged: Vec<StatusFile>,
    /// Changed, untracked and conflicted files; at most [`MAX_STATUS_FILES`].
    pub unstaged: Vec<StatusFile>,
}

/// Which untracked files are listed.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum UntrackedFiles {
    /// Every untracked file, also inside untracked folders (`--untracked-files=all`).
    All,
    /// None (`--untracked-files=no`): what users of huge trees set `status.showUntrackedFiles`
    /// to, because looking for them is the slow part.
    No,
}

impl UntrackedFiles {
    /// What the repository's `status.showUntrackedFiles` asks for: none when it is `no` (or
    /// false), otherwise all of them, so each new file can be shown and staged on its own.
    pub fn configured(repo: &gix::Repository) -> Self {
        let value = repo
            .config_snapshot()
            .string("status.showUntrackedFiles")
            .map(|value| value.to_str_lossy().to_ascii_lowercase());
        match value.as_deref() {
            Some("no" | "false" | "off" | "0") => Self::No,
            _ => Self::All,
        }
    }
}

/// Reads the status of the working tree at `work_dir`.
pub async fn working_tree_status(
    git: &Git,
    work_dir: &Path,
    untracked: UntrackedFiles,
    cancel: &CancellationToken,
) -> Result<WorkingTreeStatus, StatusError> {
    let output = git
        .command()
        .current_dir(work_dir)
        .read_only()
        .args(["status", "--porcelain=v2", "-z"])
        .arg(match untracked {
            UntrackedFiles::All => "--untracked-files=all",
            UntrackedFiles::No => "--untracked-files=no",
        })
        .run(cancel)
        .await?;
    WorkingTreeStatus::parse(&output.stdout)
}

#[cfg(test)]
mod tests;
