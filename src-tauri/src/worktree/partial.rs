//! Staging, unstaging and discarding some lines of a file, and discarding whole files, behind
//! the Tauri commands. Like every change, each holds the session's write lock.

use git_core::cli::Git;
use git_core::commit::{
    LineSelection, PartialChange, discard_lines, discard_paths, stage_lines, unstage_lines,
};
use git_core::diff::parse_object_id;
use tokio_util::sync::CancellationToken;

use super::service::work_dir;
use super::staging::exact_paths;
use super::types::{LineChangeDto, LineRangeDto};
use crate::git_env::GitEnvError;
use crate::repository::{RepoId, RepoSessions, RepositoryError};

/// What happens to the chosen lines.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LineAction {
    /// Stage them (working tree changes).
    Stage,
    /// Unstage them (staged changes).
    Unstage,
    /// Throw them away (working tree changes).
    Discard,
}

/// Stages, unstages or discards the lines `request` names.
pub async fn change_lines(
    sessions: &RepoSessions,
    id: RepoId,
    action: LineAction,
    request: LineChangeDto,
) -> Result<(), RepositoryError> {
    let session = sessions.get(id)?;
    work_dir(&session.repo).ok_or(RepositoryError::Bare)?;
    exact_paths(std::slice::from_ref(&request.path))?;
    let change = PartialChange {
        path: request.path.as_str().into(),
        old: request.old_id.as_deref().map(parse_object_id).transpose()?,
        new: parse_object_id(&request.new_id)?,
        selection: LineSelection {
            removed: request.removed.iter().copied().map(range).collect(),
            added: request.added.iter().copied().map(range).collect(),
        },
    };
    let git = Git::locate().map_err(GitEnvError::from)?;
    let repo = session.repo.local();
    let _writing = session.lock_writes().await;
    match action {
        LineAction::Stage => stage_lines(&git, repo, change).await?,
        LineAction::Unstage => unstage_lines(&git, repo, change).await?,
        LineAction::Discard => discard_lines(&git, repo, change).await?,
    }
    Ok(())
}

/// Throws away the changes of the `tracked` files and deletes the `untracked` ones.
pub async fn discard_files(
    sessions: &RepoSessions,
    id: RepoId,
    tracked: Vec<String>,
    untracked: Vec<String>,
) -> Result<(), RepositoryError> {
    let session = sessions.get(id)?;
    let work_dir = work_dir(&session.repo).ok_or(RepositoryError::Bare)?;
    let (tracked, untracked) = (exact_paths(&tracked)?, exact_paths(&untracked)?);
    let git = Git::locate().map_err(GitEnvError::from)?;
    let _writing = session.lock_writes().await;
    discard_paths(
        &git,
        &work_dir,
        tracked,
        untracked,
        &CancellationToken::new(),
    )
    .await?;
    Ok(())
}

fn range(range: LineRangeDto) -> std::ops::RangeInclusive<u32> {
    range.start..=range.end
}
