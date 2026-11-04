//! Making, applying, popping and dropping stashes with the `git` CLI.

use std::borrow::Cow;
use std::path::{Path, PathBuf};

use gix::bstr::BStr;
use tokio_util::sync::CancellationToken;

use super::StashError;
use crate::cli::{Git, GitOutput};

/// What git prints (exit 0) when there was nothing to stash.
const NOTHING_TO_SAVE: &str = "No local changes to save";

/// How to stash.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct StashOptions {
    /// The stash's message (`--message`); git's `WIP on <branch>: …` when empty.
    pub message: String,
    /// Leave the staged changes in place too (`--keep-index`).
    pub keep_index: bool,
    /// Stash new files as well, and delete them (`--include-untracked`).
    pub include_untracked: bool,
    /// Only these paths (both names of a rename); everything when `None`.
    pub paths: Option<Vec<Vec<u8>>>,
}

/// What applying a stash did.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ApplyOutcome {
    /// What git printed.
    pub output: String,
    /// It applied with merge conflicts, now in the working tree; a pop kept the stash.
    pub conflicts: bool,
}

/// Stashes the working tree's changes (`git stash push`). Fails with
/// [`StashError::NothingToStash`] when there was nothing to save.
pub async fn push_stash(
    git: &Git,
    work_dir: &Path,
    options: &StashOptions,
    cancel: &CancellationToken,
) -> Result<String, StashError> {
    let mut command = git.command().current_dir(work_dir).args(["stash", "push"]);
    if options.keep_index {
        command = command.arg("--keep-index");
    }
    if options.include_untracked {
        command = command.arg("--include-untracked");
    }
    let message = options.message.trim();
    if !message.is_empty() {
        command = command.option("--message", message);
    }
    if let Some(paths) = &options.paths {
        if paths.is_empty() {
            return Err(StashError::NothingToStash);
        }
        command = command.pathspecs_on_stdin(paths);
    }
    let output = accepted(&command.output(cancel).await?)?;
    if output.contains(NOTHING_TO_SAVE) {
        return Err(StashError::NothingToStash);
    }
    Ok(output)
}

/// Applies `stash@{index}` (`git stash apply`), or pops it (`git stash pop`: dropped unless it
/// conflicted). `restore_index` also restores what was staged (`--index`). Check the stash
/// first with [`check_stash`](super::check_stash).
pub async fn apply_stash(
    git: &Git,
    work_dir: &Path,
    index: u32,
    pop: bool,
    restore_index: bool,
    cancel: &CancellationToken,
) -> Result<ApplyOutcome, StashError> {
    let mut command = git
        .command()
        .current_dir(work_dir)
        .args(["stash", if pop { "pop" } else { "apply" }]);
    if restore_index {
        command = command.arg("--index");
    }
    let output = command.revision(&stash_name(index))?.output(cancel).await?;
    let text = output.combined();
    if output.success() {
        return Ok(ApplyOutcome {
            output: text,
            conflicts: false,
        });
    }
    // A merge that stopped on conflicts has applied the rest; anything else changed nothing.
    if text.lines().any(|line| line.starts_with("CONFLICT")) {
        return Ok(ApplyOutcome {
            output: text,
            conflicts: true,
        });
    }
    Err(StashError::Rejected { output: text })
}

/// Drops `stash@{index}` (`git stash drop`). Cannot be undone from the app. Check the stash first
/// with [`check_stash`](super::check_stash).
pub async fn drop_stash(
    git: &Git,
    work_dir: &Path,
    index: u32,
    cancel: &CancellationToken,
) -> Result<String, StashError> {
    let command = git
        .command()
        .current_dir(work_dir)
        .args(["stash", "drop"])
        .revision(&stash_name(index))?;
    accepted(&command.output(cancel).await?)
}

fn stash_name(index: u32) -> String {
    format!("stash@{{{index}}}")
}

pub(super) fn os_path(path: &BStr) -> Result<PathBuf, StashError> {
    gix::path::from_bstr(Cow::Borrowed(path))
        .map(Cow::into_owned)
        .map_err(|_| StashError::Rejected {
            output: format!("{path} is not a valid path on this system"),
        })
}

/// Everything git printed, when it succeeded; otherwise the same text as the error.
pub(super) fn accepted(output: &GitOutput) -> Result<String, StashError> {
    let text = output.combined();
    if output.success() {
        Ok(text)
    } else {
        Err(StashError::Rejected { output: text })
    }
}
