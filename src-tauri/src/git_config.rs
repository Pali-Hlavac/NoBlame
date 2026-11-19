//! Git's settings behind the Tauri commands (`git_core::config`): the repository's own
//! (`.git/config`) or the user's (`~/.gitconfig`), read, set and removed only when the user
//! asks in Settings → Git settings. See `docs/features/git-config.md`.

use std::path::PathBuf;

use git_core::cli::Git;
use git_core::config::{ConfigError, ConfigScope, read_config, set_config, unset_config};
use git_core::repo::{RepoKind, Repository};
use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::State;
use tokio_util::sync::CancellationToken;

use crate::error::{AppError, CommandResult, ErrorCode};
use crate::git_env::GitEnvError;
use crate::repository::{RepoId, RepoSessions, RepositoryError};

/// Which settings file.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum ConfigScopeDto {
    /// The repository's own (`.git/config`).
    Local,
    /// The user's, for every repository (`~/.gitconfig`).
    Global,
}

impl From<ConfigScopeDto> for ConfigScope {
    fn from(scope: ConfigScopeDto) -> Self {
        match scope {
            ConfigScopeDto::Local => Self::Local,
            ConfigScopeDto::Global => Self::Global,
        }
    }
}

/// One setting.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ConfigEntryDto {
    pub key: String,
    pub value: String,
}

/// The settings of one scope.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ConfigFileDto {
    /// The file, as git names it; `null` when it does not exist yet.
    pub path: Option<String>,
    pub entries: Vec<ConfigEntryDto>,
}

/// A settings failure as the window shows it.
pub(crate) fn config_error(error: ConfigError) -> AppError {
    match error {
        ConfigError::Git(error) => GitEnvError::from(error).into(),
        ConfigError::Rejected { output } => AppError::new(ErrorCode::GitFailed, output),
        error @ ConfigError::InvalidKey(_) => {
            AppError::new(ErrorCode::InvalidInput, error.to_string())
        }
    }
}

fn run_dir(repo: &Repository) -> PathBuf {
    let info = repo.info();
    match (&info.work_dir, info.kind) {
        (Some(work_dir), kind) if kind != RepoKind::Bare => work_dir.clone(),
        _ => info.git_dir.clone(),
    }
}

fn setup(sessions: &RepoSessions, id: RepoId) -> Result<(Git, PathBuf), RepositoryError> {
    let dir = run_dir(&sessions.get(id)?.repo);
    Ok((Git::locate().map_err(GitEnvError::from)?, dir))
}

/// The settings of `scope`, as seen from repository `id`.
#[tauri::command]
#[specta::specta]
pub async fn get_git_config(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    scope: ConfigScopeDto,
) -> CommandResult<ConfigFileDto> {
    let (git, dir) = setup(&sessions, id)?;
    let file = read_config(&git, &dir, scope.into(), &CancellationToken::new())
        .await
        .map_err(config_error)?;
    Ok(ConfigFileDto {
        path: file.path,
        entries: file
            .entries
            .into_iter()
            .map(|entry| ConfigEntryDto {
                key: entry.key,
                value: entry.value,
            })
            .collect(),
    })
}

/// Sets `key` to `value` in `scope` (every value it had is replaced).
#[tauri::command]
#[specta::specta]
pub async fn set_git_config(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    scope: ConfigScopeDto,
    key: String,
    value: String,
) -> CommandResult<()> {
    let (git, dir) = setup(&sessions, id)?;
    set_config(
        &git,
        &dir,
        scope.into(),
        &key,
        &value,
        &CancellationToken::new(),
    )
    .await
    .map_err(config_error)
}

/// Removes `key` (every value) from `scope`.
#[tauri::command]
#[specta::specta]
pub async fn unset_git_config(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    scope: ConfigScopeDto,
    key: String,
) -> CommandResult<()> {
    let (git, dir) = setup(&sessions, id)?;
    unset_config(&git, &dir, scope.into(), &key, &CancellationToken::new())
        .await
        .map_err(config_error)
}
