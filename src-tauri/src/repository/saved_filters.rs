//! Each repository's graph filter in the main window, remembered between sessions: a
//! repository opens showing what it showed when it was closed. Task windows choose their own
//! view (a Log window opened on a folder shows that folder) and are neither saved nor restored.

use git_core::graph::GraphFilter;
use serde::{Deserialize, Serialize};

use super::GraphFilterDto;
use super::recent::same_path;
use crate::storage::{JsonFile, StorageError};

/// File name of the saved filters inside the app config directory.
pub const FILTERS_FILE_NAME: &str = "graph-filters.json";
/// How many repositories keep a filter; the ones changed longest ago are forgotten first.
const MAX_SAVED: usize = 200;

/// One repository's filter.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SavedFilter {
    /// Work tree (or bare repository) path, as the recent list has it.
    path: String,
    filter: GraphFilterDto,
}

/// The saved document: the most recently changed first. A repository showing everything has
/// no entry.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SavedFilters {
    repositories: Vec<SavedFilter>,
}

/// Managed state holding the saved filters.
pub type FiltersStore = JsonFile<SavedFilters>;

/// The filter saved for the repository at `path`, if it hides anything.
pub fn saved(store: &FiltersStore, path: &str) -> Option<GraphFilterDto> {
    let file = store
        .load()
        .inspect_err(|error| tracing::warn!(%error, "could not read the saved graph filters"))
        .ok()?;
    file.repositories
        .into_iter()
        .find(|entry| same_path(&entry.path, path))
        .map(|entry| entry.filter)
}

/// Remembers `filter` for the repository at `path` (forgets it when it shows everything).
pub fn remember(
    store: &FiltersStore,
    path: &str,
    filter: &GraphFilterDto,
) -> Result<(), StorageError> {
    let mut file = store.load()?;
    let before = file.repositories.len();
    file.repositories
        .retain(|entry| !same_path(&entry.path, path));
    let hides_nothing = GraphFilter::from(filter.clone()).is_empty();
    if hides_nothing && file.repositories.len() == before {
        return Ok(());
    }
    if !hides_nothing {
        file.repositories.insert(
            0,
            SavedFilter {
                path: path.to_owned(),
                filter: filter.clone(),
            },
        );
        file.repositories.truncate(MAX_SAVED);
    }
    store.save(&file)
}

#[cfg(test)]
mod tests {
    #![allow(clippy::unwrap_used)]
    use super::*;
    use crate::repository::filter_types::TipsDto;

    fn everything() -> GraphFilterDto {
        GraphFilterDto {
            tips: TipsDto::All,
            first_parent: false,
            no_merges: false,
            author: None,
            message: None,
            path: None,
        }
    }

    fn store() -> (tempfile::TempDir, FiltersStore) {
        let dir = tempfile::tempdir().unwrap();
        let store = FiltersStore::new(dir.path().join(FILTERS_FILE_NAME));
        (dir, store)
    }

    #[test]
    fn a_filter_is_remembered_per_repository_and_forgotten_when_cleared() {
        let (_dir, store) = store();
        let mine = GraphFilterDto {
            first_parent: true,
            author: Some("ada".into()),
            ..everything()
        };
        remember(&store, "/work/app", &mine).unwrap();
        remember(
            &store,
            "/work/lib",
            &GraphFilterDto {
                tips: TipsDto::Head,
                ..everything()
            },
        )
        .unwrap();
        assert_eq!(saved(&store, "/work/app"), Some(mine));
        assert_eq!(saved(&store, "/work/other"), None);

        remember(&store, "/work/app", &everything()).unwrap();
        assert_eq!(saved(&store, "/work/app"), None);
        assert!(saved(&store, "/work/lib").is_some());
    }

    #[test]
    fn blank_text_hides_nothing_and_is_not_saved() {
        let (dir, store) = store();
        let blank = GraphFilterDto {
            message: Some("  ".into()),
            ..everything()
        };
        remember(&store, "/work/app", &blank).unwrap();
        assert!(!dir.path().join(FILTERS_FILE_NAME).exists());
    }
}
