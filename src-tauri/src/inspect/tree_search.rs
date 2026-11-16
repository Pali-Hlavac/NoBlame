//! Searching the files of a revision for the Files module's filter box: the matching entries of
//! a whole tree with the folders leading to them (`git_core::tree_search`).

use git_core::diff::parse_object_id;
use git_core::tree_search::{TreeSearch, TreeSearchRow};
use serde::Serialize;
use specta::Type;
use tauri::State;

use super::TreeEntryDto;
use crate::error::CommandResult;
use crate::repository::{RepoId, RepoSessions, RepositoryError, blocking};

/// One row of a search: a match, or a folder on the way to one.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct TreeSearchRowDto {
    /// Path from the root, `/`-separated (non-UTF-8 bytes replaced).
    pub path: String,
    /// Folders above it (0 at the root).
    pub depth: u32,
    /// The entry itself.
    pub entry: TreeEntryDto,
    /// Its path holds every word of the query.
    pub matched: bool,
}

/// What a search found.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct TreeSearchDto {
    /// Matches and the folders leading to them, in tree order (folders first, by name).
    pub rows: Vec<TreeSearchRowDto>,
    /// Matching entries listed (at most 2,000).
    pub matches: u32,
    /// Every folder was searched (false when the search stopped at the limit).
    pub complete: bool,
}

impl From<TreeSearchRow> for TreeSearchRowDto {
    fn from(row: TreeSearchRow) -> Self {
        Self {
            path: row.path.to_string(),
            depth: row.depth,
            entry: row.entry.into(),
            matched: row.matched,
        }
    }
}

impl From<TreeSearch> for TreeSearchDto {
    fn from(search: TreeSearch) -> Self {
        Self {
            rows: search
                .rows
                .into_iter()
                .map(TreeSearchRowDto::from)
                .collect(),
            matches: u32::try_from(search.matches).unwrap_or(u32::MAX),
            complete: search.complete,
        }
    }
}

async fn search(
    sessions: &RepoSessions,
    id: RepoId,
    tree: String,
    query: String,
) -> Result<TreeSearchDto, RepositoryError> {
    let repo = sessions.get(id)?.repo.clone();
    let tree = parse_object_id(&tree)?;
    let found =
        blocking(move || git_core::tree_search::search_tree(&repo.local(), tree, &query)).await??;
    Ok(found.into())
}

/// The entries of folder `tree_id` and below whose path holds every word of `query` (ignoring
/// case), with the folders leading to them; at most 2,000 matches.
#[tauri::command]
#[specta::specta]
pub async fn search_tree(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    tree_id: String,
    query: String,
) -> CommandResult<TreeSearchDto> {
    Ok(search(&sessions, id, tree_id, query).await?)
}
