//! Ignoring untracked files behind the Tauri commands: which files a pattern would hide, and
//! writing it to `.gitignore` or `info/exclude`. The file watcher sees `.gitignore` change; the
//! UI reads the status again after either.

use git_core::cli::Git;
use git_core::ignore::{IgnoreFile, add_ignore_pattern, files_hidden_by, ignore_file_path};
use serde::{Deserialize, Serialize};
use specta::Type;

use super::service::work_dir;
use crate::git_env::GitEnvError;
use crate::repository::{RepoId, RepoSessions, RepositoryError, blocking};

/// Where an ignore pattern is written.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum IgnoreFileDto {
    /// `.gitignore` at the top of the working tree, shared through commits.
    Shared,
    /// `.git/info/exclude`: only this clone.
    Local,
}

/// A pattern to add to an ignore file.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct IgnoreRequestDto {
    /// One line of `.gitignore` syntax (`*.log`, `/build/`).
    pub pattern: String,
    /// Which file to add it to.
    pub file: IgnoreFileDto,
}

/// The untracked files a pattern would hide.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct IgnorePreviewDto {
    /// Sorted, at most 200.
    pub files: Vec<String>,
    /// All of them.
    pub total: u32,
}

/// The untracked files listed now that `pattern` would hide. A newer preview cancels this one.
pub async fn preview(
    sessions: &RepoSessions,
    id: RepoId,
    pattern: String,
) -> Result<IgnorePreviewDto, RepositoryError> {
    let session = sessions.get(id)?;
    let work_dir = work_dir(&session.repo).ok_or(RepositoryError::Bare)?;
    let cancel = session.new_ignore_preview();
    let git = Git::locate().map_err(GitEnvError::from)?;
    let preview = files_hidden_by(&git, &work_dir, &pattern, &cancel).await?;
    Ok(IgnorePreviewDto {
        files: preview.files.iter().map(ToString::to_string).collect(),
        total: preview.total.try_into().unwrap_or(u32::MAX),
    })
}

/// Adds the pattern as a line of the chosen ignore file; `false` when it is already there.
pub async fn add(
    sessions: &RepoSessions,
    id: RepoId,
    request: IgnoreRequestDto,
) -> Result<bool, RepositoryError> {
    let session = sessions.get(id)?;
    work_dir(&session.repo).ok_or(RepositoryError::Bare)?;
    let file = match request.file {
        IgnoreFileDto::Shared => IgnoreFile::Shared,
        IgnoreFileDto::Local => IgnoreFile::Local,
    };
    let repo = session.repo.clone();
    let _writing = session.lock_writes().await;
    let added = blocking(move || {
        let path = ignore_file_path(&repo.local(), file)?;
        add_ignore_pattern(&path, &request.pattern)
    })
    .await??;
    Ok(added)
}
