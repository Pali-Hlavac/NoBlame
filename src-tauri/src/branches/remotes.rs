//! The remotes of an open repository: listed from a fresh read of the config (the session's
//! copy is as it was when the repository opened), and added and removed with `git remote` under
//! the session's write lock (the remote editor changes the rest: `remote_settings.rs`). The file watcher reports the remote branches that
//! were renamed or deleted, which reloads the graph and the Branches module.

use git_core::remote::{RemoteInfo, add_remote, remote_details, remove_remote};
use git_core::repo::Repository;
use tokio_util::sync::CancellationToken;

use super::remote_types::{AddRemoteRequestDto, RemoteDto};
use super::service::{git, git_dir_or_work_tree};
use crate::repository::{RepoId, RepoSessions, RepositoryError, blocking};

/// Every remote with its URLs, remote branches and the branches tracking it, sorted.
pub async fn list(sessions: &RepoSessions, id: RepoId) -> Result<Vec<RemoteDto>, RepositoryError> {
    Ok(details(sessions, id)
        .await?
        .into_iter()
        .map(RemoteDto::from)
        .collect())
}

async fn details(sessions: &RepoSessions, id: RepoId) -> Result<Vec<RemoteInfo>, RepositoryError> {
    let dir = git_dir_or_work_tree(&sessions.get(id)?.repo);
    blocking(move || -> Result<_, RepositoryError> {
        let repo = Repository::discover(&dir)?;
        Ok(remote_details(&repo.local())?)
    })
    .await?
}

/// Adds a remote; nothing is fetched (the UI starts a fetch when asked).
pub async fn add(
    sessions: &RepoSessions,
    id: RepoId,
    request: AddRemoteRequestDto,
) -> Result<String, RepositoryError> {
    let session = sessions.get(id)?;
    let dir = git_dir_or_work_tree(&session.repo);
    let git = git()?;
    let _writing = session.lock_writes().await;
    let cancel = CancellationToken::new();
    Ok(add_remote(&git, &dir, &request.name, &request.url, &cancel).await?)
}

/// Removes a remote: its remote branches go and the branches tracking it lose their upstream
/// (the UI named both before asking).
pub async fn remove(
    sessions: &RepoSessions,
    id: RepoId,
    name: String,
) -> Result<String, RepositoryError> {
    let session = sessions.get(id)?;
    let dir = git_dir_or_work_tree(&session.repo);
    let git = git()?;
    let _writing = session.lock_writes().await;
    Ok(remove_remote(&git, &dir, &name, &CancellationToken::new()).await?)
}
