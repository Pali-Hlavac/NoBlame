//! Working tree operations behind the Tauri commands: the status, and working tree files read
//! as git would store them (for diffs and previews).

use git_core::cli::Git;
use git_core::diff::{DiffError, parse_object_id, read_worktree_file, worktree_version};
use git_core::repo::RepoKind;
use git_core::status::{UntrackedFiles, working_tree_status};
use tokio_util::sync::CancellationToken;

use super::WorkingTreeStatusDto;
use crate::git_env::GitEnvError;
use crate::repository::{RawBytes, RepoId, RepoSessions, RepositoryError, blocking};

/// Previews (images) read at most this much of a file.
const MAX_PREVIEW_BYTES: u64 = 32 << 20;

/// The status of the working tree; `None` for a bare repository. Runs `git status` every
/// time: the working tree changes outside the app.
pub async fn status(
    sessions: &RepoSessions,
    id: RepoId,
) -> Result<Option<WorkingTreeStatusDto>, RepositoryError> {
    let session = sessions.get(id)?;
    let info = session.repo.info();
    let Some(work_dir) = info
        .work_dir
        .clone()
        .filter(|_| info.kind != RepoKind::Bare)
    else {
        return Ok(None);
    };
    let repo = session.repo.clone();
    let untracked = blocking(move || UntrackedFiles::configured(&repo.local())).await?;
    let git = Git::locate().map_err(GitEnvError::from)?;
    let status = working_tree_status(&git, &work_dir, untracked, &CancellationToken::new()).await?;
    Ok(Some(status.into()))
}

/// The id of the working tree file at `path` as git would store it (hex); `None` when nothing
/// or a folder is there.
pub async fn file_id(
    sessions: &RepoSessions,
    id: RepoId,
    path: String,
) -> Result<Option<String>, RepositoryError> {
    let repo = sessions.get(id)?.repo.clone();
    let file = blocking(move || read_worktree_file(&repo.local(), path.as_str().into())).await??;
    Ok(file.map(|file| file.id.to_string()))
}

/// The contents of the working tree file at `path` (at most 32 MB, as git would store it),
/// if it is still the version `blob_id` names.
pub async fn file_contents(
    sessions: &RepoSessions,
    id: RepoId,
    path: String,
    blob_id: String,
) -> Result<RawBytes, RepositoryError> {
    let repo = sessions.get(id)?.repo.clone();
    let expected = parse_object_id(&blob_id)?;
    let file =
        blocking(move || worktree_version(&repo.local(), path.as_str().into(), expected)).await??;
    match file.data {
        Some(data) if file.size <= MAX_PREVIEW_BYTES => Ok(RawBytes(data)),
        _ => Err(DiffError::TooLarge {
            size: file.size,
            limit: MAX_PREVIEW_BYTES,
        }
        .into()),
    }
}
