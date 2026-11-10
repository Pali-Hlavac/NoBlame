//! Tauri boundary for merging, cherry-picking, reverting, resetting and the operation in
//! progress.

use tauri::State;

use super::conflicts::{self, ConflictDto, MergeToolResultDto, SideDto};
use super::interactive::{self, InteractivePlanDto, InteractiveRequestDto, InteractiveResultDto};
use super::merge_view::{self, MergeFileDto, SaveMergedRequestDto};
use super::pick::{PickRequestDto, PickResultDto, ResetRequestDto};
use super::rebase::{self, RebaseOutcomeDto, RebasePreviewDto, RebaseRequestDto};
use super::service;
use super::types::{MergeRequestDto, MergeResultDto, SequenceStepDto, StepOutcomeDto};
use crate::error::CommandResult;
use crate::repository::{RepoId, RepoSessions};
use crate::settings::SettingsStore;

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

/// The commits an interactive rebase from `from` (included) up to HEAD replays, oldest first.
#[tauri::command]
#[specta::specta]
pub async fn get_interactive_plan(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    from: String,
) -> CommandResult<InteractivePlanDto> {
    Ok(interactive::plan(&sessions, id, from).await?)
}

/// Rebases interactively with the edited list (order, pick, reword, edit, squash, fixup,
/// drop). Stopping at an edit or a conflict comes back as an outcome.
#[tauri::command]
#[specta::specta]
pub async fn rebase_interactive(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    request: InteractiveRequestDto,
) -> CommandResult<InteractiveResultDto> {
    Ok(interactive::start(&sessions, id, request).await?)
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

/// The conflicted files, with which sides have them.
#[tauri::command]
#[specta::specta]
pub async fn get_conflicts(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
) -> CommandResult<Vec<ConflictDto>> {
    Ok(conflicts::list(&sessions, id).await?)
}

/// Resolves conflicted files with one side's whole version (or removes them where that side
/// deleted them) and stages them.
#[tauri::command]
#[specta::specta]
pub async fn take_conflict_side(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    paths: Vec<String>,
    side: SideDto,
) -> CommandResult<()> {
    Ok(conflicts::take(&sessions, id, paths, side).await?)
}

/// A conflicted file merged line by line from its versions (base, ours, theirs), for the
/// built-in merge view; or why it cannot be.
#[tauri::command]
#[specta::specta]
pub async fn get_merge_file(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    path: String,
) -> CommandResult<MergeFileDto> {
    Ok(merge_view::get(&sessions, id, path).await?)
}

/// Saves a file merged in the view: staged in place of its conflict and written to the working
/// tree.
#[tauri::command]
#[specta::specta]
pub async fn save_merged_file(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    request: SaveMergedRequestDto,
) -> CommandResult<()> {
    Ok(merge_view::save(&sessions, id, request).await?)
}

/// Opens a conflicted file in the merge tool chosen in Settings (through `git mergetool`).
/// Returns once the tool started (or was closed at once); fails when it could not start.
#[tauri::command]
#[specta::specta]
pub async fn open_merge_tool(
    sessions: State<'_, RepoSessions>,
    settings: State<'_, SettingsStore>,
    id: RepoId,
    path: String,
) -> CommandResult<MergeToolResultDto> {
    let tool = settings.load()?.diff.merge_tool;
    Ok(conflicts::open_merge_tool(&sessions, id, tool, path).await?)
}
