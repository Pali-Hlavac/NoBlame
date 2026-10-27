//! Recently opened repositories, newest first, saved in the app config directory.

use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use specta::Type;

use super::RepoSummary;
use crate::storage::{JsonFile, StorageError};

/// File name of the list inside the app config directory.
pub const RECENT_FILE_NAME: &str = "recent-repositories.json";
/// How many repositories the list keeps.
const MAX_RECENT: usize = 20;

/// One entry of the list as the UI sees it.
#[derive(Debug, Clone, PartialEq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct RecentRepository {
    /// Work tree (or bare repository) path.
    pub path: String,
    /// Folder name.
    pub name: String,
    /// When it was last opened, seconds since the epoch.
    pub last_opened: f64,
    /// Whether the folder still exists (checked when the list is read).
    pub exists: bool,
}

/// One entry as saved on disk.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StoredRepository {
    path: String,
    name: String,
    last_opened: f64,
}

/// The saved document.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct RecentFile {
    repositories: Vec<StoredRepository>,
}

/// Managed state holding the list.
pub type RecentStore = JsonFile<RecentFile>;

/// The list, with `exists` filled in.
pub fn list(store: &RecentStore) -> Result<Vec<RecentRepository>, StorageError> {
    Ok(store
        .load()?
        .repositories
        .into_iter()
        .map(|entry| RecentRepository {
            exists: Path::new(&entry.path).exists(),
            path: entry.path,
            name: entry.name,
            last_opened: entry.last_opened,
        })
        .collect())
}

/// Moves `summary`'s repository to the top of the list.
pub fn record(store: &RecentStore, summary: &RepoSummary) -> Result<(), StorageError> {
    let mut file = store.load()?;
    file.repositories
        .retain(|entry| !same_path(&entry.path, &summary.path));
    file.repositories.insert(
        0,
        StoredRepository {
            path: summary.path.clone(),
            name: summary.name.clone(),
            last_opened: now_seconds(),
        },
    );
    file.repositories.truncate(MAX_RECENT);
    store.save(&file)
}

/// Removes `path` from the list and returns the rest.
pub fn remove(store: &RecentStore, path: &str) -> Result<Vec<RecentRepository>, StorageError> {
    let mut file = store.load()?;
    file.repositories
        .retain(|entry| !same_path(&entry.path, path));
    store.save(&file)?;
    list(store)
}

#[cfg(windows)]
fn same_path(a: &str, b: &str) -> bool {
    a.eq_ignore_ascii_case(b)
}

#[cfg(not(windows))]
fn same_path(a: &str, b: &str) -> bool {
    a == b
}

fn now_seconds() -> f64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0.0, |elapsed| elapsed.as_secs_f64().floor())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::repository::types::{HeadDto, RepoKindDto};

    fn summary(path: &str) -> RepoSummary {
        RepoSummary {
            id: 1,
            name: path.rsplit('/').next().unwrap_or(path).to_owned(),
            path: path.to_owned(),
            git_dir: format!("{path}/.git"),
            kind: RepoKindDto::Normal,
            head: HeadDto::Branch {
                name: "main".into(),
            },
            is_shallow: false,
            has_commit_graph: false,
        }
    }

    #[test]
    fn newest_first_without_duplicates_and_bounded() {
        let dir = tempfile::tempdir().unwrap();
        let store = RecentStore::new(dir.path().join(RECENT_FILE_NAME));
        for number in 0..MAX_RECENT + 5 {
            record(&store, &summary(&format!("/repos/r{number}"))).unwrap();
        }
        record(&store, &summary("/repos/r3")).unwrap();
        let entries = list(&store).unwrap();
        assert_eq!(entries.len(), MAX_RECENT);
        assert_eq!(entries[0].path, "/repos/r3");
        assert_eq!(
            entries
                .iter()
                .filter(|entry| entry.path == "/repos/r3")
                .count(),
            1
        );
        assert!(!entries[0].exists, "the folder does not exist on disk");

        let rest = remove(&store, "/repos/r3").unwrap();
        assert!(rest.iter().all(|entry| entry.path != "/repos/r3"));
    }
}
