//! What cherry-picking, reverting and resetting take and return.

use git_core::operation::{PickKind, PickOptions, PickOutcome, PickResult, ResetMode};
use serde::{Deserialize, Serialize};
use specta::Type;

/// Which way a commit's changes are applied.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum PickKindDto {
    /// Its changes, as a new commit.
    CherryPick,
    /// The opposite of its changes, as a new commit.
    Revert,
}

/// A cherry-pick or revert of one commit onto the current branch.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct PickRequestDto {
    pub kind: PickKindDto,
    /// The commit id.
    pub commit: String,
    /// For a merge commit: the parent (1-based) its changes are taken against.
    pub mainline: Option<u32>,
    /// Stage the changes only; the user commits them.
    pub no_commit: bool,
    /// Note the picked commit's id in the message (cherry-pick only).
    pub record_origin: bool,
}

impl From<&PickRequestDto> for PickOptions {
    fn from(request: &PickRequestDto) -> Self {
        Self {
            kind: match request.kind {
                PickKindDto::CherryPick => PickKind::CherryPick,
                PickKindDto::Revert => PickKind::Revert,
            },
            mainline: request.mainline,
            no_commit: request.no_commit,
            record_origin: request.record_origin,
        }
    }
}

/// How a cherry-pick or revert ended.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum PickOutcomeDto {
    /// A new commit was made.
    Committed,
    /// The changes are staged; the user commits them.
    Staged,
    /// Nothing to do: the branch already has these changes.
    Empty,
    /// Stopped with conflicts; it is in progress.
    Conflicts,
}

/// What a cherry-pick or revert did.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct PickResultDto {
    pub outcome: PickOutcomeDto,
    /// git's summary line (`1 file changed, 2 insertions(+)`), when it printed one.
    pub summary: Option<String>,
}

impl From<PickResult> for PickResultDto {
    fn from(result: PickResult) -> Self {
        let outcome = match result.outcome {
            PickOutcome::Committed => PickOutcomeDto::Committed,
            PickOutcome::Staged => PickOutcomeDto::Staged,
            PickOutcome::Empty => PickOutcomeDto::Empty,
            PickOutcome::Conflicts => PickOutcomeDto::Conflicts,
        };
        Self {
            outcome,
            summary: summary_line(&result.output),
        }
    }
}

/// The line of git's output saying how many files changed, if any.
pub fn summary_line(output: &str) -> Option<String> {
    output
        .lines()
        .find(|line| line.contains(" changed"))
        .map(|line| line.trim().to_owned())
}

/// What a reset does with the index and the working tree.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum ResetModeDto {
    /// Only the branch moves; the changes stay staged.
    Soft,
    /// The branch and the index move; the changes stay in the files.
    Mixed,
    /// Everything matches the commit; uncommitted changes to tracked files are lost.
    Hard,
    /// Like hard, but uncommitted changes are kept (git refuses when they are in the way).
    Keep,
}

impl From<ResetModeDto> for ResetMode {
    fn from(mode: ResetModeDto) -> Self {
        match mode {
            ResetModeDto::Soft => Self::Soft,
            ResetModeDto::Mixed => Self::Mixed,
            ResetModeDto::Hard => Self::Hard,
            ResetModeDto::Keep => Self::Keep,
        }
    }
}

/// A reset of the current branch.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ResetRequestDto {
    /// The commit id to move to.
    pub commit: String,
    pub mode: ResetModeDto,
}
