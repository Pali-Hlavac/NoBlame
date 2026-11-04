//! Stashes behind the Tauri commands: made, applied, popped and dropped with git, each holding the
//! session's write lock. The stash the user chose is checked first (`stash@{n}` must still be
//! the commit they saw), so a stash made in a terminal meanwhile is never dropped by mistake.
//! The file watcher reports the changes, which refreshes the status, the graph and the list.

use git_core::cli::Git;
use git_core::diff::parse_object_id;
use git_core::stash::{
    StashOptions, apply_stash, apply_stash_files, check_stash, drop_stash, push_stash,
    stash_commits, stash_files,
};
use tokio_util::sync::CancellationToken;

use super::service::work_dir;
use super::staging::exact_paths;
use super::stash_types::{
    ApplyOutcomeDto, ApplyStashFilesRequestDto, ApplyStashRequestDto, StashFilesDto,
    StashRequestDto, StashTargetDto,
};
use crate::git_env::GitEnvError;
use crate::repository::{RepoId, RepoSessions, RepositoryError, blocking};

/// Stashes the working tree's changes (or some files); returns what git printed.
pub async fn push(
    sessions: &RepoSessions,
    id: RepoId,
    request: StashRequestDto,
) -> Result<String, RepositoryError> {
    let session = sessions.get(id)?;
    let work_dir = work_dir(&session.repo).ok_or(RepositoryError::Bare)?;
    let git = Git::locate().map_err(GitEnvError::from)?;
    let paths = match &request.paths {
        Some(paths) => Some(
            exact_paths(paths)?
                .iter()
                .map(|path| path.as_bytes().to_vec())
                .collect(),
        ),
        None => None,
    };
    let options = StashOptions {
        message: request.message,
        keep_index: request.keep_index,
        include_untracked: request.include_untracked,
        paths,
    };
    let _writing = session.lock_writes().await;
    Ok(push_stash(&git, &work_dir, &options, &CancellationToken::new()).await?)
}

/// Applies or pops a whole stash.
pub async fn apply(
    sessions: &RepoSessions,
    id: RepoId,
    request: ApplyStashRequestDto,
) -> Result<ApplyOutcomeDto, RepositoryError> {
    let session = sessions.get(id)?;
    let work_dir = work_dir(&session.repo).ok_or(RepositoryError::Bare)?;
    let git = Git::locate().map_err(GitEnvError::from)?;
    let _writing = session.lock_writes().await;
    let index = checked(sessions, id, &request.stash).await?;
    let cancel = CancellationToken::new();
    let outcome = apply_stash(
        &git,
        &work_dir,
        index,
        request.pop,
        request.restore_index,
        &cancel,
    )
    .await?;
    Ok(outcome.into())
}

/// Drops a stash; returns what git printed (`Dropped stash@{0} (…)`).
pub async fn drop(
    sessions: &RepoSessions,
    id: RepoId,
    stash: StashTargetDto,
) -> Result<String, RepositoryError> {
    let session = sessions.get(id)?;
    let work_dir = work_dir(&session.repo).ok_or(RepositoryError::Bare)?;
    let git = Git::locate().map_err(GitEnvError::from)?;
    let _writing = session.lock_writes().await;
    let index = checked(sessions, id, &stash).await?;
    Ok(drop_stash(&git, &work_dir, index, &CancellationToken::new()).await?)
}

/// The files a stash changed, and the untracked files it saved.
pub async fn files(
    sessions: &RepoSessions,
    id: RepoId,
    stash_id: String,
) -> Result<StashFilesDto, RepositoryError> {
    let repo = sessions.get(id)?.repo.clone();
    let stash = parse_object_id(&stash_id)?;
    let files = blocking(move || stash_files(&repo.local(), stash)).await??;
    Ok(files.into())
}

/// Applies some files of a stash; the stash is kept.
pub async fn apply_files(
    sessions: &RepoSessions,
    id: RepoId,
    request: ApplyStashFilesRequestDto,
) -> Result<ApplyOutcomeDto, RepositoryError> {
    let session = sessions.get(id)?;
    let work_dir = work_dir(&session.repo).ok_or(RepositoryError::Bare)?;
    let git = Git::locate().map_err(GitEnvError::from)?;
    let stash = parse_object_id(&request.id)?;
    let tracked = exact_paths(&request.tracked)?;
    let untracked = exact_paths(&request.untracked)?;
    let repo = session.repo.clone();
    let commits = blocking(move || stash_commits(&repo.local(), stash)).await??;
    let _writing = session.lock_writes().await;
    let cancel = CancellationToken::new();
    let outcome = apply_stash_files(&git, &work_dir, &commits, tracked, untracked, &cancel).await?;
    Ok(outcome.into())
}

/// `stash@{index}` after checking it is still the stash the user chose.
async fn checked(
    sessions: &RepoSessions,
    id: RepoId,
    stash: &StashTargetDto,
) -> Result<u32, RepositoryError> {
    let repo = sessions.get(id)?.repo.clone();
    let (index, commit) = (stash.index, parse_object_id(&stash.id)?);
    blocking(move || check_stash(&repo.local(), index, commit)).await??;
    Ok(index)
}
