//! Branches and tags behind the Tauri commands, each change holding the session's write lock.
//! A branch or tag the user picked is checked first (it must still point at the commit they
//! saw), so one moved in a terminal meanwhile is never renamed or deleted by mistake. The file
//! watcher reports the changed refs, which reloads the graph and the Branches module.

use std::path::PathBuf;

use git_core::branch::{
    CreateBranch, RefNamespace, check_ref, create_branch, create_tag, delete_branch, delete_tag,
    head_commit, rename_branch, switch_branch, switch_detached, unique_commits,
};
use git_core::cli::Git;
use git_core::diff::parse_object_id;
use git_core::repo::{RepoKind, Repository};
use tokio_util::sync::CancellationToken;

use super::types::{
    CreateBranchRequestDto, CreateTagRequestDto, RefTargetDto, RenameBranchRequestDto,
    UniqueCommitsDto,
};
use crate::git_env::GitEnvError;
use crate::repository::{RepoId, RepoSessions, RepositoryError, blocking};

/// Where git runs: the work tree, or the repository itself when it is bare.
pub(super) fn git_dir_or_work_tree(repo: &Repository) -> PathBuf {
    let info = repo.info();
    match (&info.work_dir, info.kind) {
        (Some(work_dir), kind) if kind != RepoKind::Bare => work_dir.clone(),
        _ => info.git_dir.clone(),
    }
}

/// The work tree; checking out needs one.
fn work_tree(repo: &Repository) -> Result<PathBuf, RepositoryError> {
    let info = repo.info();
    info.work_dir
        .clone()
        .filter(|_| info.kind != RepoKind::Bare)
        .ok_or(RepositoryError::Bare)
}

pub(super) fn git() -> Result<Git, RepositoryError> {
    Ok(Git::locate().map_err(GitEnvError::from)?)
}

/// Checks that `reference` still points where the user saw it.
async fn checked(repo: &Repository, reference: &RefTargetDto) -> Result<(), RepositoryError> {
    let full_name = RefNamespace::from(reference.namespace).full_name(&reference.name);
    let expected = parse_object_id(&reference.target)?;
    let repo = repo.clone();
    blocking(move || check_ref(&repo.local(), &full_name, expected)).await??;
    Ok(())
}

/// Checks out the local branch `name`; returns what git printed.
pub async fn checkout_branch(
    sessions: &RepoSessions,
    id: RepoId,
    name: String,
) -> Result<String, RepositoryError> {
    let session = sessions.get(id)?;
    let dir = work_tree(&session.repo)?;
    let git = git()?;
    let _writing = session.lock_writes().await;
    Ok(switch_branch(&git, &dir, &name, &CancellationToken::new()).await?)
}

/// Checks out `commit` without a branch.
pub async fn checkout_commit(
    sessions: &RepoSessions,
    id: RepoId,
    commit: String,
) -> Result<String, RepositoryError> {
    let session = sessions.get(id)?;
    let dir = work_tree(&session.repo)?;
    let commit = parse_object_id(&commit)?.to_string();
    let git = git()?;
    let _writing = session.lock_writes().await;
    Ok(switch_detached(&git, &dir, &commit, &CancellationToken::new()).await?)
}

/// Creates a branch, and checks it out when asked.
pub async fn create(
    sessions: &RepoSessions,
    id: RepoId,
    request: CreateBranchRequestDto,
) -> Result<String, RepositoryError> {
    let session = sessions.get(id)?;
    let dir = if request.checkout {
        work_tree(&session.repo)?
    } else {
        git_dir_or_work_tree(&session.repo)
    };
    let git = git()?;
    let branch = CreateBranch {
        name: request.name,
        start: request.start,
        checkout: request.checkout,
        track: request.track,
    };
    let _writing = session.lock_writes().await;
    Ok(create_branch(&git, &dir, &branch, &CancellationToken::new()).await?)
}

/// Renames a branch the user saw.
pub async fn rename(
    sessions: &RepoSessions,
    id: RepoId,
    request: RenameBranchRequestDto,
) -> Result<String, RepositoryError> {
    let session = sessions.get(id)?;
    let dir = git_dir_or_work_tree(&session.repo);
    let git = git()?;
    let _writing = session.lock_writes().await;
    checked(&session.repo, &request.branch).await?;
    let cancel = CancellationToken::new();
    Ok(rename_branch(&git, &dir, &request.branch.name, &request.new_name, &cancel).await?)
}

/// The commits only `reference` holds (no other branch, remote branch, tag or HEAD).
pub async fn unique(
    sessions: &RepoSessions,
    id: RepoId,
    reference: RefTargetDto,
) -> Result<UniqueCommitsDto, RepositoryError> {
    let session = sessions.get(id)?;
    let dir = git_dir_or_work_tree(&session.repo);
    let tip = parse_object_id(&reference.target)?;
    let repo = session.repo.clone();
    let head = blocking(move || head_commit(&repo.local())).await?;
    let git = git()?;
    let unique = unique_commits(
        &git,
        &dir,
        reference.namespace.into(),
        &reference.name,
        tip,
        head,
        &CancellationToken::new(),
    )
    .await?;
    Ok(unique.into())
}

/// Deletes a branch or tag the user saw (and confirmed, with the commits only it held).
pub async fn delete(
    sessions: &RepoSessions,
    id: RepoId,
    reference: RefTargetDto,
) -> Result<String, RepositoryError> {
    let session = sessions.get(id)?;
    let dir = git_dir_or_work_tree(&session.repo);
    let git = git()?;
    let _writing = session.lock_writes().await;
    checked(&session.repo, &reference).await?;
    let cancel = CancellationToken::new();
    let output = match RefNamespace::from(reference.namespace) {
        RefNamespace::Branch => delete_branch(&git, &dir, &reference.name, &cancel).await?,
        RefNamespace::Tag => delete_tag(&git, &dir, &reference.name, &cancel).await?,
        RefNamespace::Remote => {
            return Err(RepositoryError::Branch(
                git_core::branch::BranchError::Rejected {
                    output: "Remote branches are deleted on the remote, with a push.".into(),
                },
            ));
        }
    };
    Ok(output)
}

/// Creates a tag, annotated when it has a message.
pub async fn tag(
    sessions: &RepoSessions,
    id: RepoId,
    request: CreateTagRequestDto,
) -> Result<String, RepositoryError> {
    let session = sessions.get(id)?;
    let dir = git_dir_or_work_tree(&session.repo);
    let git = git()?;
    let _writing = session.lock_writes().await;
    let cancel = CancellationToken::new();
    let message = request.message.as_deref();
    Ok(create_tag(&git, &dir, &request.name, &request.target, message, &cancel).await?)
}
