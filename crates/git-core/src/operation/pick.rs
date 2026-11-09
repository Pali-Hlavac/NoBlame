//! `git cherry-pick` and `git revert`: applying one commit's changes, or their opposite, to the
//! current branch.

use std::path::Path;

use tokio_util::sync::CancellationToken;

use super::OperationError;
use crate::cli::Git;

/// Which way a commit's changes are applied.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PickKind {
    /// Its changes, as a new commit (`git cherry-pick`).
    CherryPick,
    /// The opposite of its changes, as a new commit (`git revert`).
    Revert,
}

impl PickKind {
    fn verb(self) -> &'static str {
        match self {
            Self::CherryPick => "cherry-pick",
            Self::Revert => "revert",
        }
    }
}

/// How to pick.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PickOptions {
    /// Cherry-pick or revert.
    pub kind: PickKind,
    /// For a merge commit: the parent (1-based) whose side counts as the mainline, so the
    /// changes are the merge's relative to it (`--mainline`). `None` for other commits.
    pub mainline: Option<u32>,
    /// Stage the changes only; the user commits them (`--no-commit`).
    pub no_commit: bool,
    /// Note the picked commit's id in the message (`-x`; cherry-pick only).
    pub record_origin: bool,
}

/// How a pick ended.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PickOutcome {
    /// A new commit was made.
    Committed,
    /// The changes are staged for the user to commit (`--no-commit`).
    Staged,
    /// Nothing changed: the branch already has these changes (or their opposite). Nothing is
    /// left in progress.
    Empty,
    /// It stopped with conflicts; the cherry-pick or revert is in progress.
    Conflicts,
}

/// What a pick did, with what git printed.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PickResult {
    /// How it ended.
    pub outcome: PickOutcome,
    /// Standard output and standard error, trimmed.
    pub output: String,
}

/// Cherry-picks or reverts `commit` onto the current branch in `work_dir`. The message is
/// git's (`--no-edit`; there is no terminal for an editor). Conflicts are not an error: the
/// operation is left in progress for the user to resolve. A pick that would be empty is
/// skipped, so nothing stays in progress for it.
pub async fn pick(
    git: &Git,
    work_dir: &Path,
    commit: &str,
    options: PickOptions,
    cancel: &CancellationToken,
) -> Result<PickResult, OperationError> {
    let verb = options.kind.verb();
    let mut command = git.command().current_dir(work_dir).arg(verb);
    command = if options.no_commit {
        command.arg("--no-commit")
    } else {
        command.arg("--no-edit")
    };
    if options.record_origin && options.kind == PickKind::CherryPick {
        command = command.arg("-x");
    }
    if let Some(parent) = options.mainline {
        command = command.option("--mainline", parent.to_string());
    }
    let output = command.revision(commit)?.output(cancel).await?;
    let text = output.combined();
    if output.success() {
        let outcome = if options.no_commit {
            PickOutcome::Staged
        } else {
            PickOutcome::Committed
        };
        return Ok(PickResult {
            outcome,
            output: text,
        });
    }
    if text.contains("CONFLICT")
        || text.contains("could not apply")
        || text.contains("could not revert")
    {
        return Ok(PickResult {
            outcome: PickOutcome::Conflicts,
            output: text,
        });
    }
    if text.contains("is now empty") {
        // git stops with the empty pick in progress; leave it out, as `--empty=drop` would
        // (git 2.45 and later only).
        let skip = git
            .command()
            .current_dir(work_dir)
            .arg(verb)
            .arg("--skip")
            .output(cancel)
            .await?;
        if !skip.success() {
            return Err(OperationError::Rejected {
                output: skip.combined(),
            });
        }
        return Ok(PickResult {
            outcome: PickOutcome::Empty,
            output: text,
        });
    }
    if text.contains("nothing to commit") {
        return Ok(PickResult {
            outcome: PickOutcome::Empty,
            output: text,
        });
    }
    Err(OperationError::Rejected { output: text })
}
