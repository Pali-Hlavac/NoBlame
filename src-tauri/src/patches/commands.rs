//! Tauri boundary for patches: counting the commits of a range, saving their patches (the app
//! asks where), checking patch files and applying them.

use tauri::{State, WebviewWindow};

use super::service;
use super::types::{
    ApplyModeDto, PatchCheckDto, PatchCommitsDto, PatchCountDto, PatchOutcomeDto,
    SavePatchesRequestDto, SavedPatchesDto,
};
use crate::error::CommandResult;
use crate::repository::{RepoId, RepoSessions};

/// How many commits get a patch, and how many merges are left out.
#[tauri::command]
#[specta::specta]
pub async fn count_patches(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    commits: PatchCommitsDto,
) -> CommandResult<PatchCountDto> {
    Ok(service::count(&sessions, id, commits).await?)
}

/// Asks where (a file, or a folder for one file per commit), then saves the patches. `null`
/// when cancelled.
#[tauri::command]
#[specta::specta]
pub async fn save_patches(
    window: WebviewWindow,
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    request: SavePatchesRequestDto,
) -> CommandResult<Option<SavedPatchesDto>> {
    Ok(service::save(&window, &sessions, id, request).await?)
}

/// What the patch files at `paths` hold, whether they apply (as `mode` would apply them) and
/// the files they change.
#[tauri::command]
#[specta::specta]
pub async fn check_patches(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    paths: Vec<String>,
    mode: ApplyModeDto,
) -> CommandResult<PatchCheckDto> {
    Ok(service::check(&sessions, id, paths, mode).await?)
}

/// Applies the patch files at `paths`, in the order of their names: as commits (`git am`) or
/// only to the files (`git apply`). Conflicts come back as an outcome.
#[tauri::command]
#[specta::specta]
pub async fn apply_patches(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    paths: Vec<String>,
    mode: ApplyModeDto,
) -> CommandResult<PatchOutcomeDto> {
    Ok(service::apply(&sessions, id, paths, mode).await?)
}
