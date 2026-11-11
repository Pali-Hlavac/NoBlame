//! Git LFS behind the Tauri commands (`git_core::lfs`): the LFS files of a repository with
//! whether each has its content or only its pointer, and the locks on the LFS server (listing,
//! locking, unlocking). Downloading contents is a job (`jobs::commands::pull_lfs`).
//! See `docs/features/lfs.md`.

use std::path::PathBuf;

use git_core::cli::Git;
use git_core::lfs::{LfsError, LfsFile, LfsLock, lfs_lock, lfs_locks, lfs_state, lfs_unlock};
use git_core::repo::{RepoKind, Repository};
use serde::Serialize;
use specta::Type;
use tauri::State;
use tokio_util::sync::CancellationToken;

use crate::error::{AppError, CommandResult, ErrorCode};
use crate::git_env::GitEnvError;
use crate::repository::{RepoId, RepoSessions, RepositoryError};

/// A file stored in Git LFS.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct LfsFileDto {
    pub path: String,
    /// As git-lfs words it (`3.0 KB`).
    pub size: String,
    /// The object id (sha256, hex).
    pub oid: String,
    /// False when the working tree has only the pointer (the content was not downloaded).
    pub has_content: bool,
}

/// Git LFS in a repository.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct LfsStateDto {
    /// `git lfs version`; `null` when git-lfs is not installed.
    pub version: Option<String>,
    /// The LFS files of the commit checked out (at most 20,000).
    pub files: Vec<LfsFileDto>,
    pub total: u32,
}

/// The locks on the LFS server, and why there may be none.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct LfsLocksDto {
    pub locks: Vec<LfsLockDto>,
    /// What git-lfs said besides (it lists none when it cannot reach a server, saying why here).
    pub warning: Option<String>,
    /// What that means, when it is a usual case.
    pub hint: Option<String>,
}

/// A lock on the LFS server.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct LfsLockDto {
    pub id: String,
    pub path: String,
    /// Who holds it, as the server names them.
    pub owner: Option<String>,
    /// When (RFC 3339).
    pub locked_at: String,
}

impl From<LfsFile> for LfsFileDto {
    fn from(file: LfsFile) -> Self {
        Self {
            path: file.path,
            size: file.size,
            oid: file.oid,
            has_content: file.has_content,
        }
    }
}

impl From<LfsLock> for LfsLockDto {
    fn from(lock: LfsLock) -> Self {
        Self {
            id: lock.id,
            path: lock.path,
            owner: lock.owner.map(|owner| owner.name),
            locked_at: lock.locked_at,
        }
    }
}

/// git-lfs's words, and what to do about them.
const HINTS: &[(&str, &str)] = &[
    (
        "file:// URL",
        "Locks live on an LFS server (GitHub, GitLab, Bitbucket, …); this remote is a folder, which has none.",
    ),
    (
        "missing protocol",
        "Locks live on an LFS server (GitHub, GitLab, Bitbucket, …); this remote has none.",
    ),
    (
        "is not a git-lfs command",
        "Git LFS is not installed. Install it from git-lfs.com, then try again.",
    ),
    (
        "lock already created",
        "Someone holds a lock on this file already. Refresh the locks to see who.",
    ),
    (
        "Cannot unlock",
        "This lock is someone else's. Force it only if you are sure they no longer need it.",
    ),
];

/// A next step for git-lfs's refusal `output`, if there is a usual one.
pub fn lfs_hint(output: &str) -> Option<&'static str> {
    HINTS
        .iter()
        .find(|(words, _)| output.contains(words))
        .map(|(_, hint)| *hint)
}

/// The error shown for `error`.
pub fn lfs_error(error: LfsError) -> AppError {
    match error {
        LfsError::Git(error) => GitEnvError::from(error).into(),
        LfsError::Rejected { output } => {
            let hint = lfs_hint(&output);
            let error = AppError::new(ErrorCode::GitFailed, output);
            match hint {
                Some(hint) => error.with_hint(hint),
                None => error,
            }
        }
        error @ LfsError::Parse(_) => {
            tracing::error!(%error, "git lfs output not understood");
            AppError::new(ErrorCode::GitFailed, error.to_string())
        }
    }
}

fn work_tree(repo: &Repository) -> Result<PathBuf, RepositoryError> {
    let info = repo.info();
    info.work_dir
        .clone()
        .filter(|_| info.kind != RepoKind::Bare)
        .ok_or(RepositoryError::Bare)
}

fn setup(sessions: &RepoSessions, id: RepoId) -> Result<(Git, PathBuf), RepositoryError> {
    let dir = work_tree(&sessions.get(id)?.repo)?;
    Ok((Git::locate().map_err(GitEnvError::from)?, dir))
}

/// Whether git-lfs is installed, and the repository's LFS files with or without their content.
#[tauri::command]
#[specta::specta]
pub async fn get_lfs(sessions: State<'_, RepoSessions>, id: RepoId) -> CommandResult<LfsStateDto> {
    let (git, dir) = setup(&sessions, id)?;
    let state = lfs_state(&git, &dir, &CancellationToken::new())
        .await
        .map_err(RepositoryError::from)?;
    Ok(LfsStateDto {
        version: state.version,
        files: state.files.into_iter().map(LfsFileDto::from).collect(),
        total: u32::try_from(state.total).unwrap_or(u32::MAX),
    })
}

/// The locks on the LFS server of the repository's remote, with git-lfs's warning, if any.
#[tauri::command]
#[specta::specta]
pub async fn list_lfs_locks(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
) -> CommandResult<LfsLocksDto> {
    let (git, dir) = setup(&sessions, id)?;
    let (locks, warning) = lfs_locks(&git, &dir, &CancellationToken::new())
        .await
        .map_err(RepositoryError::from)?;
    Ok(LfsLocksDto {
        locks: locks.into_iter().map(LfsLockDto::from).collect(),
        hint: warning.as_deref().and_then(lfs_hint).map(str::to_owned),
        warning,
    })
}

/// Locks `path` (relative, `/` separated) on the LFS server; returns what git-lfs said.
#[tauri::command]
#[specta::specta]
pub async fn lock_lfs_file(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    path: String,
) -> CommandResult<String> {
    let (git, dir) = setup(&sessions, id)?;
    Ok(lfs_lock(&git, &dir, &path, &CancellationToken::new())
        .await
        .map_err(RepositoryError::from)?)
}

/// Unlocks lock `lock_id` (`force`: someone else's); returns what git-lfs said.
#[tauri::command]
#[specta::specta]
pub async fn unlock_lfs_file(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    lock_id: String,
    force: bool,
) -> CommandResult<String> {
    let (git, dir) = setup(&sessions, id)?;
    Ok(
        lfs_unlock(&git, &dir, &lock_id, force, &CancellationToken::new())
            .await
            .map_err(RepositoryError::from)?,
    )
}

#[cfg(test)]
mod tests {
    use super::lfs_hint;

    #[test]
    fn hints_name_the_next_step() {
        let output = "Error while retrieving locks: missing protocol: \"file:///repo\"";
        assert!(lfs_hint(output).is_some_and(|hint| hint.contains("LFS server")));
        assert_eq!(lfs_hint("something new"), None);
    }
}
