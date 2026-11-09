//! Going on with, skipping, or aborting the operation in progress.

use std::path::Path;

use tokio_util::sync::CancellationToken;

use super::{OperationError, OperationKind};
use crate::cli::{Git, GitCommand};

/// What to do with the operation in progress.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SequenceStep {
    /// Go on after the conflicts were resolved (and staged): commit the merge, the picked
    /// commit, or continue the rebase.
    Continue,
    /// Leave out the commit it stopped at and go on (cherry-pick, revert, rebase, `git am`).
    Skip,
    /// Stop and put everything back as it was before the operation started.
    Abort,
}

/// What a step did.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StepResult {
    /// It went on and stopped at the next commit whose changes conflict (a rebase, or a
    /// sequence of cherry-picks); the operation is still in progress.
    pub conflicts: bool,
    /// Standard output and standard error, trimmed.
    pub output: String,
}

/// Runs `step` for the operation `kind` in `work_dir`. Messages are taken as git prepared them:
/// `GIT_EDITOR=true` accepts the prepared message instead of opening an editor (there is no
/// terminal). Stopping again at the next conflict is a result; git refusing (conflicts left
/// unresolved) is `Rejected`.
pub async fn run_step(
    git: &Git,
    work_dir: &Path,
    kind: OperationKind,
    step: SequenceStep,
    cancel: &CancellationToken,
) -> Result<StepResult, OperationError> {
    let command = step_command(git, kind, step)?
        .current_dir(work_dir)
        .env("GIT_EDITOR", "true");
    let output = command.output(cancel).await?;
    let text = output.combined();
    if output.success() {
        return Ok(StepResult {
            conflicts: false,
            output: text,
        });
    }
    // Only applying the next commit says these; refusing to continue says neither.
    if text.contains("CONFLICT") || text.contains("could not apply") {
        return Ok(StepResult {
            conflicts: true,
            output: text,
        });
    }
    Err(OperationError::Rejected { output: text })
}

fn step_command(
    git: &Git,
    kind: OperationKind,
    step: SequenceStep,
) -> Result<GitCommand, OperationError> {
    let command = git.command();
    let verb = match kind {
        OperationKind::Merge => "merge",
        OperationKind::CherryPick => "cherry-pick",
        OperationKind::Revert => "revert",
        OperationKind::Rebase => "rebase",
        OperationKind::ApplyMailbox => "am",
        OperationKind::Bisect => {
            // Bisect has no conflicts to resolve; it only ends.
            return match step {
                SequenceStep::Abort => Ok(command.args(["bisect", "reset"])),
                _ => Err(OperationError::NotApplicable(
                    "Bisecting goes on from the graph (good or bad); it can only be stopped here."
                        .to_owned(),
                )),
            };
        }
    };
    let flag = match step {
        // `git merge --continue` commits with the prepared message, as `git commit` would.
        SequenceStep::Continue => "--continue",
        SequenceStep::Abort => "--abort",
        SequenceStep::Skip if kind == OperationKind::Merge => {
            return Err(OperationError::NotApplicable(
                "A merge has no commit to skip: resolve the conflicts, or abort it.".to_owned(),
            ));
        }
        SequenceStep::Skip => "--skip",
    };
    Ok(command.arg(verb).arg(flag))
}
