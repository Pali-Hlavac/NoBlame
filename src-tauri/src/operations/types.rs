//! What the history-changing commands take and return.

use git_core::operation::{
    MergeMode, MergeOutcome, MergeResult, Operation, OperationKind, SequenceStep,
};
use serde::{Deserialize, Serialize};
use specta::Type;

use super::pick::summary_line;

/// How a merge joins the histories.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum MergeModeDto {
    /// As `merge.ff` says: fast-forward when possible, else a merge commit.
    Default,
    /// Always a merge commit (`--no-ff`).
    NoFastForward,
    /// Only a fast-forward (`--ff-only`).
    FastForwardOnly,
    /// Stage the combined changes for a commit the user makes (`--squash`).
    Squash,
}

impl From<MergeModeDto> for MergeMode {
    fn from(mode: MergeModeDto) -> Self {
        match mode {
            MergeModeDto::Default => Self::Default,
            MergeModeDto::NoFastForward => Self::NoFastForward,
            MergeModeDto::FastForwardOnly => Self::FastForwardOnly,
            MergeModeDto::Squash => Self::Squash,
        }
    }
}

/// A merge into the current branch.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct MergeRequestDto {
    /// What to merge: a branch, remote branch or tag name, or a commit id.
    pub revision: String,
    pub mode: MergeModeDto,
}

/// How a merge ended.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum MergeOutcomeDto {
    /// The branch already contains it.
    UpToDate,
    /// The branch moved forward; no merge commit.
    FastForwarded,
    /// A merge commit was made.
    Merged,
    /// The changes are staged; the user commits them.
    Squashed,
    /// Stopped with conflicts; the merge is in progress.
    Conflicts,
}

/// What a merge did.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct MergeResultDto {
    pub outcome: MergeOutcomeDto,
    /// git's summary line (`2 files changed, 3 insertions(+)`), when it printed one.
    pub summary: Option<String>,
}

impl From<MergeResult> for MergeResultDto {
    fn from(result: MergeResult) -> Self {
        let outcome = match result.outcome {
            MergeOutcome::UpToDate => MergeOutcomeDto::UpToDate,
            MergeOutcome::FastForwarded => MergeOutcomeDto::FastForwarded,
            MergeOutcome::Merged => MergeOutcomeDto::Merged,
            MergeOutcome::Squashed => MergeOutcomeDto::Squashed,
            MergeOutcome::Conflicts => MergeOutcomeDto::Conflicts,
        };
        Self {
            outcome,
            summary: summary_line(&result.output),
        }
    }
}

/// The kind of operation in progress.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum OperationKindDto {
    Merge,
    CherryPick,
    Revert,
    Rebase,
    /// `git am`.
    ApplyMailbox,
    Bisect,
}

/// An operation in progress (a merge stopped by conflicts, a rebase, ...).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct OperationDto {
    pub kind: OperationKindDto,
    /// What it works on: `Merge branch 'x'`, `a1b2c3d4 Fix the parser`, the rebased branch.
    pub detail: Option<String>,
    /// The step a rebase stopped at (1-based) and how many there are.
    pub step: Option<u32>,
    pub steps: Option<u32>,
}

impl From<Operation> for OperationDto {
    fn from(operation: Operation) -> Self {
        let kind = match operation.kind {
            OperationKind::Merge => OperationKindDto::Merge,
            OperationKind::CherryPick => OperationKindDto::CherryPick,
            OperationKind::Revert => OperationKindDto::Revert,
            OperationKind::Rebase => OperationKindDto::Rebase,
            OperationKind::ApplyMailbox => OperationKindDto::ApplyMailbox,
            OperationKind::Bisect => OperationKindDto::Bisect,
        };
        Self {
            kind,
            detail: operation.detail,
            step: operation.step.map(|(step, _)| step),
            steps: operation.step.map(|(_, steps)| steps),
        }
    }
}

/// What to do with the operation in progress.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum SequenceStepDto {
    /// Go on after the conflicts are resolved and staged.
    Continue,
    /// Leave out the commit it stopped at (not for a merge).
    Skip,
    /// Put everything back as before the operation.
    Abort,
}

/// Where a step left the operation.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum StepOutcomeDto {
    /// Nothing is in progress any more (finished or aborted).
    Finished,
    /// It went on and stopped at the next commit whose changes conflict.
    Conflicts,
    /// It is still in progress without conflicts (a bisect, a paused rebase).
    InProgress,
}

impl From<SequenceStepDto> for SequenceStep {
    fn from(step: SequenceStepDto) -> Self {
        match step {
            SequenceStepDto::Continue => Self::Continue,
            SequenceStepDto::Skip => Self::Skip,
            SequenceStepDto::Abort => Self::Abort,
        }
    }
}
