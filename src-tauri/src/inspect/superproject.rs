//! The superproject's branches in a submodule's graph: which commit each local branch of the
//! repository the submodule is in records for it (`git_core::submodule::superproject_pointers`).

use git_core::submodule::superproject_pointers;
use serde::Serialize;
use specta::Type;
use tauri::State;

use crate::error::CommandResult;
use crate::repository::{RepoId, RepoSessions, RepositoryError, blocking};

/// One commit of the submodule that superproject branches record.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct SuperprojectLabelDto {
    /// The submodule's commit (hex).
    pub commit: String,
    /// Its row in the submodule's graph, when shown.
    pub row: Option<u32>,
    /// The superproject's local branches recording it, sorted.
    pub branches: Vec<String>,
}

/// What the superproject's local branches record for this submodule.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct SuperprojectBranchesDto {
    /// The superproject's work tree.
    pub superproject: String,
    /// The submodule's path in it.
    pub path: String,
    /// The submodule's commits that branches record, by commit.
    pub labels: Vec<SuperprojectLabelDto>,
}

async fn read(
    sessions: &RepoSessions,
    id: RepoId,
) -> Result<Option<SuperprojectBranchesDto>, RepositoryError> {
    let session = sessions.get(id)?;
    let repo = session.repo.clone();
    let Some(found) = blocking(move || superproject_pointers(&repo.local())).await?? else {
        return Ok(None);
    };
    let graph = session.graph(false).await?;
    let labels = found
        .pointers
        .into_iter()
        .map(|(commit, branches)| SuperprojectLabelDto {
            commit: commit.to_string(),
            row: graph.lookup_row(&commit),
            branches,
        })
        .collect();
    Ok(Some(SuperprojectBranchesDto {
        superproject: found.superproject.display().to_string(),
        path: found.path.to_string(),
        labels,
    }))
}

/// For a submodule: which of its commits the local branches of the repository it is in record,
/// with their rows; `null` for a repository that is no submodule (or that no branch records).
#[tauri::command]
#[specta::specta]
pub async fn get_superproject_branches(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
) -> CommandResult<Option<SuperprojectBranchesDto>> {
    Ok(read(&sessions, id).await?)
}
