//! Working tree operations behind the Tauri commands: the status, and working tree files read
//! as git would store them (for diffs and previews).

use std::path::PathBuf;

use git_core::cli::Git;
use git_core::diff::{DiffError, parse_object_id, read_worktree_file, worktree_version};
use git_core::repo::{RepoKind, Repository};
use git_core::status::{
    UntrackedFiles, staged_outside, working_tree_status, working_tree_status_in,
};
use tokio::sync::Semaphore;
use tokio_util::sync::CancellationToken;

use super::{ChangeCountsDto, WorkingTreeStatusDto};
use crate::git_env::GitEnvError;
use crate::operations::current_operation;
use crate::repository::{RawBytes, RepoId, RepoSessions, RepositoryError, blocking};

/// Previews (images) read at most this much of a file.
const MAX_PREVIEW_BYTES: u64 = 32 << 20;

/// `git status` runs for closed repositories at once at most: the Repositories module asks for
/// every grouped and recent repository together, and each run reads its whole working tree.
const COUNT_RUNS: usize = 4;
static COUNT_PERMITS: Semaphore = Semaphore::const_new(COUNT_RUNS);

/// The status of the working tree; `None` for a bare repository. Runs `git status` every
/// time: the working tree changes outside the app.
pub async fn status(
    sessions: &RepoSessions,
    id: RepoId,
    scope: Option<String>,
) -> Result<Option<WorkingTreeStatusDto>, RepositoryError> {
    let session = sessions.get(id)?;
    let Some(work_dir) = work_dir(&session.repo) else {
        return Ok(None);
    };
    let repo = session.repo.clone();
    let untracked = blocking(move || UntrackedFiles::configured(&repo.local())).await?;
    let git = Git::locate().map_err(GitEnvError::from)?;
    let cancel = CancellationToken::new();
    let (status, outside) = match scope.as_deref().filter(|scope| !scope.is_empty()) {
        // Two git runs at once: the second only compares the index with HEAD.
        Some(scope) => tokio::try_join!(
            working_tree_status_in(&git, &work_dir, untracked, scope, &cancel),
            staged_outside(&git, &work_dir, scope, &cancel),
        )?,
        None => (
            working_tree_status(&git, &work_dir, untracked, &cancel).await?,
            0,
        ),
    };
    let operation = current_operation(&session.repo).await?;
    Ok(Some(WorkingTreeStatusDto::new(status, operation, outside)))
}

/// The uncommitted files of the repository at `path` (no session: it need not be open), counted
/// once each; `None` for a bare repository. One `git status`, at most [`COUNT_RUNS`] at a time.
pub async fn change_counts(path: String) -> Result<Option<ChangeCountsDto>, RepositoryError> {
    let (work_dir, untracked) = blocking(move || {
        let repo = Repository::discover(&PathBuf::from(path))?;
        let untracked = UntrackedFiles::configured(&repo.local());
        Ok::<_, RepositoryError>((work_dir(&repo), untracked))
    })
    .await??;
    let Some(work_dir) = work_dir else {
        return Ok(None);
    };
    let git = Git::locate().map_err(GitEnvError::from)?;
    // Never closed, so acquiring only fails if it were; then run without waiting.
    let _permit = COUNT_PERMITS.acquire().await.ok();
    let status = working_tree_status(&git, &work_dir, untracked, &CancellationToken::new()).await?;
    Ok(Some(status.summary.changes.into()))
}

/// The working tree of `repo`; `None` for a bare repository.
pub(super) fn work_dir(repo: &Repository) -> Option<PathBuf> {
    let info = repo.info();
    info.work_dir
        .clone()
        .filter(|_| info.kind != RepoKind::Bare)
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
