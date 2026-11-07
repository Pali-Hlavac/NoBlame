//! Tauri boundary for background jobs: listing, logs, cancelling; starting fetch, pull, push
//! and clone; the remotes to push to.

use std::sync::Arc;

use tauri::State;

use super::clone::CloneRequestDto;
use super::registry::JobRegistry;
use super::types::{FetchRequestDto, JobDto, JobId, JobOutputDto, PullRequestDto, PushRequestDto};
use super::{clone, fetch, sync};
use crate::error::CommandResult;

/// Running and recent jobs, newest first.
#[tauri::command]
#[specta::specta]
pub fn list_jobs(registry: State<'_, Arc<JobRegistry>>) -> Vec<JobDto> {
    registry.list()
}

/// A job's log from line `from` on (progress updates left out), so a window streaming it reads
/// only what is new.
#[tauri::command]
#[specta::specta]
pub fn get_job_output(registry: State<'_, Arc<JobRegistry>>, id: JobId, from: u32) -> JobOutputDto {
    registry.output(id, from)
}

/// Cancels a running job, killing git and everything it started. False when the job is
/// unknown or already over.
#[tauri::command]
#[specta::specta]
pub fn cancel_job(registry: State<'_, Arc<JobRegistry>>, id: JobId) -> bool {
    registry.cancel(id)
}

/// Starts `git fetch` in the background; progress and the result come as `JobUpdated`.
#[tauri::command]
#[specta::specta]
pub async fn fetch_repository(
    registry: State<'_, Arc<JobRegistry>>,
    request: FetchRequestDto,
) -> CommandResult<JobId> {
    Ok(fetch::start(&registry, request).await?)
}

/// Starts `git pull` of the current branch; progress and the result come as `JobUpdated`.
#[tauri::command]
#[specta::specta]
pub async fn pull_repository(
    registry: State<'_, Arc<JobRegistry>>,
    request: PullRequestDto,
) -> CommandResult<JobId> {
    Ok(sync::pull(&registry, request).await?)
}

/// Starts `git push` (a branch, a tag, or deleting one on the remote).
#[tauri::command]
#[specta::specta]
pub async fn push_repository(
    registry: State<'_, Arc<JobRegistry>>,
    request: PushRequestDto,
) -> CommandResult<JobId> {
    Ok(sync::push(&registry, request).await?)
}

/// Starts `git push` of the current branch of the repository at `path` to its upstream (open or
/// not); refused when HEAD is detached or the branch has no upstream on a remote.
#[tauri::command]
#[specta::specta]
pub async fn push_current_branch(
    registry: State<'_, Arc<JobRegistry>>,
    path: String,
) -> CommandResult<JobId> {
    Ok(sync::push_current(&registry, path).await?)
}

/// Starts `git clone` into a new (or empty) folder; the UI opens it when the job succeeded.
#[tauri::command]
#[specta::specta]
pub async fn clone_repository(
    registry: State<'_, Arc<JobRegistry>>,
    request: CloneRequestDto,
) -> CommandResult<JobId> {
    Ok(clone::start(&registry, request).await?)
}

/// The remotes of the repository at `path`, sorted.
#[tauri::command]
#[specta::specta]
pub async fn list_remotes(path: String) -> CommandResult<Vec<String>> {
    Ok(sync::remotes(path).await?)
}
