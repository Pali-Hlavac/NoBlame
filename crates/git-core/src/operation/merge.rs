//! `git merge`: joining another branch or commit into the current branch.

use std::path::Path;

use tokio_util::sync::CancellationToken;

use super::OperationError;
use crate::cli::Git;

/// How the merge joins the histories.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MergeMode {
    /// As the user's config says (`merge.ff`): fast-forward when possible, else a merge commit.
    Default,
    /// Always a merge commit, even when a fast-forward is possible (`--no-ff`).
    NoFastForward,
    /// Only fast-forward; refuse when both sides have new commits (`--ff-only`).
    FastForwardOnly,
    /// Stage the combined changes without committing or recording the merge (`--squash`).
    Squash,
}

/// How a merge ended.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MergeOutcome {
    /// Nothing to merge: the branch already contains it.
    UpToDate,
    /// The branch moved forward to it; no merge commit.
    FastForwarded,
    /// A merge commit was made.
    Merged,
    /// The changes are staged for a commit the user makes (`--squash`).
    Squashed,
    /// It stopped with conflicts to resolve; the merge is in progress (staged with `--squash`).
    Conflicts,
}

/// What a merge did, with git's own summary line (`2 files changed, 3 insertions(+)`).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MergeResult {
    /// How it ended.
    pub outcome: MergeOutcome,
    /// What git printed, trimmed.
    pub output: String,
}

/// Merges `revision` (a branch, remote branch, tag or commit id) into the current branch in
/// `work_dir`. `--no-edit` takes git's message (there is no terminal for an editor); git
/// refuses when local changes would be overwritten. Conflicts are not an error: the merge is
/// left in progress for the user to resolve.
pub async fn merge(
    git: &Git,
    work_dir: &Path,
    revision: &str,
    mode: MergeMode,
    cancel: &CancellationToken,
) -> Result<MergeResult, OperationError> {
    let command = git
        .command()
        .current_dir(work_dir)
        .args(["merge", "--no-edit"]);
    let command = match mode {
        MergeMode::Default => command,
        MergeMode::NoFastForward => command.arg("--no-ff"),
        MergeMode::FastForwardOnly => command.arg("--ff-only"),
        MergeMode::Squash => command.arg("--squash"),
    }
    .revision(revision)?;
    let output = command.output(cancel).await?;
    let text = output.combined();
    if !output.success() {
        // git exits with 1 both for conflicts and for refusals; only conflicts leave a merge.
        if text.contains("CONFLICT") || text.contains("Automatic merge failed") {
            return Ok(MergeResult {
                outcome: MergeOutcome::Conflicts,
                output: text,
            });
        }
        return Err(OperationError::Rejected { output: text });
    }
    let outcome = if text.contains("Already up to date") {
        MergeOutcome::UpToDate
    } else if mode == MergeMode::Squash {
        MergeOutcome::Squashed
    } else if text.contains("Fast-forward") {
        MergeOutcome::FastForwarded
    } else {
        MergeOutcome::Merged
    };
    Ok(MergeResult {
        outcome,
        output: text,
    })
}

/// The name to merge `revision` by: git writes it into the message as given, so a full name
/// (`refs/heads/topic`) becomes the short one (`topic`) when that resolves to the same
/// reference; when it is ambiguous (a branch and a tag both named `topic`) the full name stays.
/// Blocking.
pub fn merge_name(repo: &gix::Repository, revision: &str) -> String {
    let short = ["refs/heads/", "refs/remotes/", "refs/tags/"]
        .iter()
        .find_map(|prefix| revision.strip_prefix(prefix));
    let Some(short) = short else {
        return revision.to_owned();
    };
    match repo.find_reference(short) {
        Ok(found) if found.name().as_bstr() == revision => short.to_owned(),
        _ => revision.to_owned(),
    }
}
