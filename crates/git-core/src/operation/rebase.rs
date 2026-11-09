//! `git rebase <onto>`: replaying the current branch's own commits on top of another commit,
//! and what a rebase would replay, named before it runs.

use std::path::Path;

use tokio_util::sync::CancellationToken;

use super::OperationError;
use crate::branch::{UniqueCommits, commits_not_in};
use crate::cli::Git;

/// How to rebase.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct RebaseOptions {
    /// Stash uncommitted changes first and bring them back afterwards (`--autostash`); without
    /// it git refuses while there are any.
    pub autostash: bool,
    /// Keep merge commits in the replayed history (`--rebase-merges`); without it they are
    /// left out and their branches' commits come in a line.
    pub rebase_merges: bool,
}

/// How a rebase ended.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RebaseOutcome {
    /// Nothing to do: the branch already contains `onto`.
    UpToDate,
    /// The branch's commits were replayed on top of `onto` (or it simply moved forward).
    Rebased,
    /// Rebased, but the stashed changes conflicted when brought back: the files have conflict
    /// markers and the changes are also kept in the stash list.
    StashConflicts,
    /// It stopped at a commit whose changes conflict; the rebase is in progress.
    Conflicts,
}

/// What a rebase did, with what git printed.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RebaseResult {
    /// How it ended.
    pub outcome: RebaseOutcome,
    /// Standard output and standard error, trimmed.
    pub output: String,
}

/// Rebases the current branch (or a detached HEAD) in `work_dir` onto `onto`. Conflicts are not
/// an error: the rebase is left in progress for the user to resolve. `GIT_EDITOR=true` keeps
/// git from waiting for an editor (there is no terminal).
pub async fn rebase(
    git: &Git,
    work_dir: &Path,
    onto: &str,
    options: RebaseOptions,
    cancel: &CancellationToken,
) -> Result<RebaseResult, OperationError> {
    let mut command = git
        .command()
        .current_dir(work_dir)
        .env("GIT_EDITOR", "true")
        .arg("rebase")
        // Said either way, so `rebase.autoStash` in the config does not overrule the choice.
        .arg(if options.autostash {
            "--autostash"
        } else {
            "--no-autostash"
        });
    if options.rebase_merges {
        command = command.arg("--rebase-merges");
    }
    let output = command.revision(onto)?.output(cancel).await?;
    let text = output.combined();
    if !output.success() {
        if text.contains("CONFLICT") || text.contains("could not apply") {
            return Ok(RebaseResult {
                outcome: RebaseOutcome::Conflicts,
                output: text,
            });
        }
        return Err(OperationError::Rejected { output: text });
    }
    let outcome = if text.contains("resulted in conflicts") {
        RebaseOutcome::StashConflicts
    } else if text.contains("is up to date") {
        RebaseOutcome::UpToDate
    } else {
        RebaseOutcome::Rebased
    };
    Ok(RebaseResult {
        outcome,
        output: text,
    })
}

/// What rebasing onto a commit would replay.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RebasePreview {
    /// The commits HEAD has and `onto` lacks: they are replayed, so they get new ids.
    pub replayed: UniqueCommits,
    /// How many of them are on a remote-tracking branch: already pushed, so the branch must be
    /// force pushed after the rebase (and others may have built on them).
    pub published: u32,
}

/// What rebasing HEAD onto `onto` in `work_dir` would replay, and how much of it was pushed.
/// Read-only.
pub async fn rebase_preview(
    git: &Git,
    work_dir: &Path,
    onto: &str,
    cancel: &CancellationToken,
) -> Result<RebasePreview, OperationError> {
    let replayed = commits_not_in(git, work_dir, "HEAD", onto, cancel).await?;
    if replayed.count == 0 {
        return Ok(RebasePreview {
            replayed,
            published: 0,
        });
    }
    // The replayed commits that no remote-tracking branch has.
    let output = git
        .command()
        .current_dir(work_dir)
        .read_only()
        .args(["rev-list", "--count", "HEAD", "--not"])
        .revision(onto)?
        .arg("--remotes")
        .output(cancel)
        .await?;
    if !output.success() {
        return Err(OperationError::Rejected {
            output: output.combined(),
        });
    }
    // Unreadable counts as none local: the warning about pushed commits shows rather than not.
    let local = output.stdout_lossy().trim().parse::<u32>().unwrap_or(0);
    Ok(RebasePreview {
        published: replayed.count.saturating_sub(local),
        replayed,
    })
}
