//! Tauri boundary for background jobs: listing, logs, cancelling, and starting a fetch.

use std::sync::Arc;

use tauri::State;

use super::fetch;
use super::registry::JobRegistry;
use super::types::{FetchRequestDto, JobDto, JobId};
use crate::error::CommandResult;

/// Running and recent jobs, newest first.
#[tauri::command]
#[specta::specta]
pub fn list_jobs(registry: State<'_, Arc<JobRegistry>>) -> Vec<JobDto> {
    registry.list()
}

/// A job's output so far, line by line (progress updates left out).
#[tauri::command]
#[specta::specta]
pub fn get_job_log(registry: State<'_, Arc<JobRegistry>>, id: JobId) -> Vec<String> {
    registry.log(id)
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
