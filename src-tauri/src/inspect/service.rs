//! Inspect operations behind the Tauri commands. They reuse the session's graph, so they cost
//! nothing extra when the repository tab has already loaded its history.

use git_core::graph::{RefKind, commit_details};

use super::{CommitDetailsDto, RefEntry};
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
