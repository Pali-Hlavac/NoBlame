//! Merging and the operation in progress behind the Tauri commands. Each change holds the
//! session's write lock; the file watcher reports what changed (refs, index, working tree), so
//! the graph and the status follow by themselves.

use std::path::PathBuf;

use git_core::cli::Git;
use git_core::operation::{
    OperationError, merge, merge_name, operation_in_progress, pick, reset, run_step,
};
use git_core::repo::{RepoKind, Repository};
use tokio_util::sync::CancellationToken;

use super::error::OperationsError;
use super::pick::{PickRequestDto, PickResultDto, ResetRequestDto};
use super::types::{
    MergeRequestDto, MergeResultDto, OperationDto, SequenceStepDto, StepOutcomeDto,
};
use crate::git_env::GitEnvError;
use crate::repository::{RepoId, RepoSessions, RepositoryError, blocking};

/// The work tree: merging and resolving need one.
pub(super) fn work_tree(repo: &Repository) -> Result<PathBuf, RepositoryError> {
    let info = repo.info();
    info.work_dir
        .clone()
        .filter(|_| info.kind != RepoKind::Bare)
        .ok_or(RepositoryError::Bare)
}

pub(super) fn git() -> Result<Git, RepositoryError> {
    Ok(Git::locate().map_err(GitEnvError::from)?)
}

/// The operation in progress in `repo`, if any.
pub async fn current_operation(repo: &Repository) -> Result<Option<OperationDto>, RepositoryError> {
    let repo = repo.clone();
    blocking(move || operation_in_progress(&repo.local()).map(OperationDto::from)).await
}

/// Merges `request.revision` into the current branch. Conflicts are a result, not an error:
/// the merge is then in progress.
pub async fn merge_into_current(
    sessions: &RepoSessions,
    id: RepoId,
    request: MergeRequestDto,
) -> Result<MergeResultDto, OperationsError> {
    let session = sessions.get(id)?;
    let dir = work_tree(&session.repo)?;
    let git = git()?;
    let _writing = session.lock_writes().await;
    let repo = session.repo.clone();
    let revision = request.revision;
    let name = blocking(move || merge_name(&repo.local(), &revision)).await?;
    let result = merge(
        &git,
        &dir,
        &name,
        request.mode.into(),
        &CancellationToken::new(),
    )
    .await?;
    Ok(result.into())
}

/// Continues, skips or aborts the operation in progress; says whether it finished, stopped at
/// the next conflict, or goes on.
pub async fn step_operation(
    sessions: &RepoSessions,
    id: RepoId,
    step: SequenceStepDto,
) -> Result<StepOutcomeDto, OperationsError> {
    let session = sessions.get(id)?;
    let dir = work_tree(&session.repo)?;
    let git = git()?;
    let _writing = session.lock_writes().await;
    let repo = session.repo.clone();
    let operation = blocking(move || operation_in_progress(&repo.local())).await?;
    let Some(operation) = operation else {
        return Err(OperationError::NotApplicable(
            "Nothing is in progress any more (it was finished or aborted elsewhere).".to_owned(),
        )
        .into());
    };
    let result = run_step(
        &git,
        &dir,
        operation.kind,
        step.into(),
        &CancellationToken::new(),
    )
    .await?;
    if result.conflicts {
        return Ok(StepOutcomeDto::Conflicts);
    }
    let repo = session.repo.clone();
    let after = blocking(move || operation_in_progress(&repo.local())).await?;
    Ok(if after.is_some() {
        StepOutcomeDto::InProgress
    } else {
        StepOutcomeDto::Finished
    })
}

/// Cherry-picks or reverts one commit onto the current branch. Conflicts are a result: the
/// operation is then in progress.
pub async fn pick_commit(
    sessions: &RepoSessions,
    id: RepoId,
    request: PickRequestDto,
) -> Result<PickResultDto, OperationsError> {
    let session = sessions.get(id)?;
    let dir = work_tree(&session.repo)?;
    let git = git()?;
    let _writing = session.lock_writes().await;
    let options = (&request).into();
    let result = pick(
        &git,
        &dir,
        &request.commit,
        options,
        &CancellationToken::new(),
    )
    .await?;
    Ok(result.into())
}

/// Resets the current branch (or a detached HEAD) to a commit; returns what git printed.
pub async fn reset_current(
    sessions: &RepoSessions,
    id: RepoId,
    request: ResetRequestDto,
) -> Result<String, OperationsError> {
    let session = sessions.get(id)?;
    let dir = work_tree(&session.repo)?;
    let git = git()?;
    let _writing = session.lock_writes().await;
    Ok(reset(
        &git,
        &dir,
        &request.commit,
        request.mode.into(),
        &CancellationToken::new(),
    )
    .await?)
}
