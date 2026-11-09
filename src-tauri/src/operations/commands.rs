//! Tauri boundary for merging, cherry-picking, reverting, resetting and the operation in
//! progress.

use tauri::State;

use super::pick::{PickRequestDto, PickResultDto, ResetRequestDto};
use super::rebase::{self, RebaseOutcomeDto, RebasePreviewDto, RebaseRequestDto};
use super::service;
use super::types::{MergeRequestDto, MergeResultDto, SequenceStepDto, StepOutcomeDto};
use crate::error::CommandResult;
use crate::repository::{RepoId, RepoSessions};

/// Merges a branch, remote branch, tag or commit into the current branch. Conflicts come back
/// as an outcome: the merge is then in progress (see the status's `operation`).
#[tauri::command]
#[specta::specta]
pub async fn merge_into_current(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    request: MergeRequestDto,
) -> CommandResult<MergeResultDto> {
    Ok(service::merge_into_current(&sessions, id, request).await?)
}

/// Continues, skips or aborts the operation in progress (merge, cherry-pick, revert, rebase,
/// `git am`, bisect); says whether it finished, stopped at the next conflict, or goes on.
#[tauri::command]
#[specta::specta]
pub async fn step_operation(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    step: SequenceStepDto,
) -> CommandResult<StepOutcomeDto> {
    Ok(service::step_operation(&sessions, id, step).await?)
}

/// Cherry-picks or reverts one commit onto the current branch. Conflicts come back as an
/// outcome: the cherry-pick or revert is then in progress.
#[tauri::command]
#[specta::specta]
pub async fn pick_commit(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    request: PickRequestDto,
) -> CommandResult<PickResultDto> {
    Ok(service::pick_commit(&sessions, id, request).await?)
}

/// Resets the current branch to a commit (soft, mixed, hard or keep); returns what git printed.
#[tauri::command]
#[specta::specta]
pub async fn reset_current(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    request: ResetRequestDto,
) -> CommandResult<String> {
    Ok(service::reset_current(&sessions, id, request).await?)
}

/// Rebases the current branch onto a branch, tag or commit. Conflicts come back as an outcome:
/// the rebase is then in progress.
#[tauri::command]
#[specta::specta]
pub async fn rebase_current(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    request: RebaseRequestDto,
) -> CommandResult<RebaseOutcomeDto> {
    Ok(rebase::rebase_current(&sessions, id, request).await?)
}

/// What rebasing the current branch onto `onto` would replay, and how much of it was pushed.
#[tauri::command]
#[specta::specta]
pub async fn get_rebase_preview(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    onto: String,
) -> CommandResult<RebasePreviewDto> {
    Ok(rebase::preview(&sessions, id, onto).await?)
}
