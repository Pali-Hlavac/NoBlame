//! Rebasing the current branch onto another commit: what it takes and returns, and the service
//! behind the commands.

use git_core::operation::{RebaseOptions, RebaseOutcome, rebase, rebase_preview};
use serde::{Deserialize, Serialize};
use specta::Type;
use tokio_util::sync::CancellationToken;

use super::error::OperationsError;
use super::service::{git, work_tree};
use crate::branches::UniqueCommitsDto;
use crate::repository::{RepoId, RepoSessions};

/// A rebase of the current branch.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct RebaseRequestDto {
    /// What to replay the branch's own commits on: a branch, remote branch or tag name, or a
    /// commit id.
    pub onto: String,
    /// Stash uncommitted changes first and bring them back afterwards.
    pub autostash: bool,
    /// Keep merge commits instead of leaving them out.
    pub rebase_merges: bool,
}

/// How a rebase ended.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum RebaseOutcomeDto {
    /// The branch already contains it.
    UpToDate,
    /// The commits were replayed (or the branch moved forward).
    Rebased,
    /// Rebased; bringing back the stashed changes conflicted (they are also in the stash list).
    StashConflicts,
    /// Stopped with conflicts; the rebase is in progress.
    Conflicts,
}

impl From<RebaseOutcome> for RebaseOutcomeDto {
    fn from(outcome: RebaseOutcome) -> Self {
        match outcome {
            RebaseOutcome::UpToDate => Self::UpToDate,
            RebaseOutcome::Rebased => Self::Rebased,
            RebaseOutcome::StashConflicts => Self::StashConflicts,
            RebaseOutcome::Conflicts => Self::Conflicts,
        }
    }
}

/// What rebasing onto a commit would replay.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct RebasePreviewDto {
    /// The commits that get new ids.
    pub replayed: UniqueCommitsDto,
    /// How many of them a remote-tracking branch has (pushed already).
    pub published: u32,
}

/// Rebases the current branch onto `request.onto`. Conflicts are a result: the rebase is then
/// in progress.
pub async fn rebase_current(
    sessions: &RepoSessions,
    id: RepoId,
    request: RebaseRequestDto,
) -> Result<RebaseOutcomeDto, OperationsError> {
    let session = sessions.get(id)?;
    let dir = work_tree(&session.repo)?;
    let git = git()?;
    let _writing = session.lock_writes().await;
    let options = RebaseOptions {
        autostash: request.autostash,
        rebase_merges: request.rebase_merges,
    };
    let result = rebase(
        &git,
        &dir,
        &request.onto,
        options,
        &CancellationToken::new(),
    )
    .await?;
    Ok(result.outcome.into())
}

/// What rebasing the current branch onto `onto` would replay.
pub async fn preview(
    sessions: &RepoSessions,
    id: RepoId,
    onto: String,
) -> Result<RebasePreviewDto, OperationsError> {
    let session = sessions.get(id)?;
    let dir = work_tree(&session.repo)?;
    let preview = rebase_preview(&git()?, &dir, &onto, &CancellationToken::new()).await?;
    Ok(RebasePreviewDto {
        replayed: preview.replayed.into(),
        published: preview.published,
    })
}
