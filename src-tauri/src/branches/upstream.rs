//! Upstreams of local branches behind the Tauri commands. Every branch's upstream is listed at
//! once (cheap); ahead and behind are counted only for the branches the UI asks for (the rows
//! on screen), because counting all of thousands of diverged branches takes seconds.

use git_core::branch::{BranchError, ahead_behind, set_upstream, unset_upstream, upstreams};
use tokio_util::sync::CancellationToken;

use super::service::{git, git_dir_or_work_tree};
use super::types::{BranchTrackingDto, SetUpstreamRequestDto, UpstreamDto};
use crate::repository::{RepoId, RepoSessions, RepositoryError};

/// At most this many branches are counted per request (a screenful is about 50); more are
/// ignored, which also keeps git's command line short.
const MAX_COUNTED_BRANCHES: usize = 256;

/// The reference prefixes an upstream may have.
const UPSTREAM_PREFIXES: [&str; 2] = ["refs/remotes/", "refs/heads/"];

/// Every local branch with an upstream.
pub async fn list(
    sessions: &RepoSessions,
    id: RepoId,
) -> Result<Vec<UpstreamDto>, RepositoryError> {
    let session = sessions.get(id)?;
    let dir = git_dir_or_work_tree(&session.repo);
    let listed = upstreams(&git()?, &dir, &CancellationToken::new()).await?;
    Ok(listed.into_iter().map(UpstreamDto::from).collect())
}

/// Ahead and behind for `branches` (the first [`MAX_COUNTED_BRANCHES`]).
pub async fn counts(
    sessions: &RepoSessions,
    id: RepoId,
    mut branches: Vec<String>,
) -> Result<Vec<BranchTrackingDto>, RepositoryError> {
    branches.truncate(MAX_COUNTED_BRANCHES);
    let session = sessions.get(id)?;
    let dir = git_dir_or_work_tree(&session.repo);
    let counted = ahead_behind(&git()?, &dir, &branches, &CancellationToken::new()).await?;
    Ok(counted.into_iter().map(BranchTrackingDto::from).collect())
}

/// Sets the upstream of a local branch, or removes it when `upstream` is `None`.
pub async fn set(
    sessions: &RepoSessions,
    id: RepoId,
    request: SetUpstreamRequestDto,
) -> Result<String, RepositoryError> {
    let session = sessions.get(id)?;
    let dir = git_dir_or_work_tree(&session.repo);
    let git = git()?;
    let cancel = CancellationToken::new();
    let _writing = session.lock_writes().await;
    let output = match request.upstream {
        Some(upstream) => {
            if !UPSTREAM_PREFIXES
                .iter()
                .any(|prefix| upstream.starts_with(prefix))
            {
                return Err(RepositoryError::Branch(BranchError::Rejected {
                    output: format!("“{upstream}” is not a branch or a remote branch."),
                }));
            }
            set_upstream(&git, &dir, &request.branch, &upstream, &cancel).await?
        }
        None => unset_upstream(&git, &dir, &request.branch, &cancel).await?,
    };
    Ok(output)
}
