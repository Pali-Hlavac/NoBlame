//! Tauri boundary for the git installation.

use super::{GitInfo, probe};
use crate::error::CommandResult;

/// Finds git and reports its path and version, or explains how to install it.
#[tauri::command]
#[specta::specta]
pub async fn get_git_info() -> CommandResult<GitInfo> {
    Ok(probe().await?)
}
