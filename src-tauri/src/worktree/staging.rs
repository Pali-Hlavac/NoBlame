//! Changing the working tree's index and committing it, behind the Tauri commands. Each change
//! holds the session's write lock, so two never race for git's index lock; the file watcher
//! then reports the change, which refreshes the status and the graph.

use std::path::PathBuf;

use git_core::cli::Git;
use git_core::commit::{
    CommitOptions, commit, head_message, stage_all, stage_paths, unstage_all, unstage_paths,
};
use tokio_util::sync::CancellationToken;

use super::service::work_dir;
use super::types::{CommitRequestDto, CommitResultDto};
use crate::git_env::GitEnvError;
use crate::repository::{RepoId, RepoSessions, RepositoryError, blocking};

/// What to stage or unstage.
pub enum Scope {
    /// These paths (display paths from the status).
    Paths(Vec<String>),
    /// Everything.
    All,
}

/// Stages `scope` as it is in the working tree.
pub async fn stage(
    sessions: &RepoSessions,
    id: RepoId,
    scope: Scope,
) -> Result<(), RepositoryError> {
    change_index(sessions, id, scope, true).await
}

/// Puts `scope` in the index back as it is in `HEAD`.
pub async fn unstage(
    sessions: &RepoSessions,
    id: RepoId,
    scope: Scope,
) -> Result<(), RepositoryError> {
    change_index(sessions, id, scope, false).await
}

async fn change_index(
    sessions: &RepoSessions,
    id: RepoId,
    scope: Scope,
    stage: bool,
) -> Result<(), RepositoryError> {
    let session = sessions.get(id)?;
    let work_dir = work_dir(&session.repo).ok_or(RepositoryError::Bare)?;
    let git = Git::locate().map_err(GitEnvError::from)?;
    let cancel = CancellationToken::new();
    let _writing = session.lock_writes().await;
    match scope {
        Scope::Paths(paths) => {
            let paths = exact_paths(&paths)?;
            if stage {
                stage_paths(&git, &work_dir, paths, &cancel).await?;
            } else {
                unstage_paths(&git, &work_dir, paths, &cancel).await?;
            }
        }
        Scope::All if stage => stage_all(&git, &work_dir, &cancel).await?,
        Scope::All => unstage_all(&git, &work_dir, &cancel).await?,
    }
    Ok(())
}

/// Commits the staged changes; returns what git and its hooks printed.
pub async fn create_commit(
    sessions: &RepoSessions,
    id: RepoId,
    request: CommitRequestDto,
) -> Result<CommitResultDto, RepositoryError> {
    let session = sessions.get(id)?;
    let work_dir: PathBuf = work_dir(&session.repo).ok_or(RepositoryError::Bare)?;
    let git = Git::locate().map_err(GitEnvError::from)?;
    let options = CommitOptions {
        message: request.message.into(),
        amend: request.amend,
        sign_off: request.sign_off,
    };
    let _writing = session.lock_writes().await;
    let result = commit(&git, &work_dir, &options, &CancellationToken::new()).await?;
    Ok(CommitResultDto {
        output: result.output,
    })
}

/// The last commit's message, for amending (`None` before the first commit).
pub async fn last_message(
    sessions: &RepoSessions,
    id: RepoId,
) -> Result<Option<String>, RepositoryError> {
    let repo = sessions.get(id)?.repo.clone();
    let message = blocking(move || head_message(&repo.local())).await??;
    Ok(message.map(|message| String::from_utf8_lossy(&message).into_owned()))
}

/// Checks the paths can go back to git. A display path with a replacement character stood for
/// a name that is not UTF-8; passing it back would name another file (or none).
pub(super) fn exact_paths(paths: &[String]) -> Result<&[String], RepositoryError> {
    match paths
        .iter()
        .find(|path| path.contains(char::REPLACEMENT_CHARACTER))
    {
        Some(path) => Err(RepositoryError::LossyPath(path.clone())),
        None => Ok(paths),
    }
}
