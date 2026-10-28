//! Inspect operations behind the Tauri commands. They reuse the session's graph, so they cost
//! nothing extra when the repository tab has already loaded its history.

use git_core::graph::{RefKind, commit_details};
use git_core::stash::list_stashes;

use super::{CommitDetailsDto, RefEntry, StashDto};
use crate::repository::{RepoId, RepoSessions, RepositoryError, blocking};

/// Details of the commit on `row`, including the references containing it.
pub async fn details(
    sessions: &RepoSessions,
    id: RepoId,
    row: u32,
) -> Result<CommitDetailsDto, RepositoryError> {
    let session = sessions.get(id)?;
    let graph = session.graph(false).await?;
    let repo = session.repo.clone();
    let details = blocking(move || commit_details(&repo.local(), &graph, row)).await??;
    Ok(details.into())
}

/// Local branches, remote branches and tags (not a detached HEAD), sorted by kind and name.
pub async fn refs(sessions: &RepoSessions, id: RepoId) -> Result<Vec<RefEntry>, RepositoryError> {
    let graph = sessions.get(id)?.graph(false).await?;
    Ok(graph
        .refs_with_rows()
        .into_iter()
        .filter(|(reference, _)| reference.kind != RefKind::DetachedHead)
        .map(|(reference, row)| RefEntry::new(reference, row))
        .collect())
}

/// The stash list, newest first. Read from disk every time (stashes change outside the app).
pub async fn stashes(
    sessions: &RepoSessions,
    id: RepoId,
) -> Result<Vec<StashDto>, RepositoryError> {
    let repo = sessions.get(id)?.repo.clone();
    let stashes = blocking(move || list_stashes(&repo.local())).await??;
    Ok(stashes.into_iter().map(StashDto::from).collect())
}
