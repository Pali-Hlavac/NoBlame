//! Repository groups: named folders in the Repositories module that hold repositories like
//! bookmarks, saved in the app config directory. The UI sends the whole list on every change
//! (it is small); saving cleans it up rather than refusing it.

use std::collections::HashSet;
use std::path::Path;

use serde::{Deserialize, Serialize};
use specta::Type;

use super::recent::same_path;
use crate::storage::{JsonFile, StorageError};

/// File name of the groups inside the app config directory.
pub const GROUPS_FILE_NAME: &str = "repository-groups.json";
/// Most groups kept; more are dropped when saving.
const MAX_GROUPS: usize = 500;
/// Most repositories kept per group.
const MAX_REPOSITORIES_PER_GROUP: usize = 2_000;
/// Longest group name, in characters.
const MAX_NAME_CHARS: usize = 100;
/// Name given to a group saved with an empty one.
const DEFAULT_NAME: &str = "Group";

/// One group, in the order the user arranged.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct RepositoryGroup {
    /// Stable id chosen by the UI.
    pub id: String,
    /// Name shown in the module.
    pub name: String,
    /// Whether the group is shown folded.
    pub collapsed: bool,
    /// Work tree (or bare repository) paths, in the user's order.
    pub repositories: Vec<String>,
}

/// The groups as the UI sees them.
#[derive(Debug, Clone, PartialEq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct RepositoryGroupsDto {
    /// The groups, in order.
    pub groups: Vec<RepositoryGroup>,
    /// Grouped paths whose folder no longer exists (checked when the list is read).
    pub missing: Vec<String>,
}

/// The saved document.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct GroupsFile {
    groups: Vec<RepositoryGroup>,
}

/// Managed state holding the groups.
pub type GroupsStore = JsonFile<GroupsFile>;

/// The saved groups, with missing folders marked.
pub fn list(store: &GroupsStore) -> Result<RepositoryGroupsDto, StorageError> {
    Ok(with_missing(store.load()?.groups))
}

/// Replaces the groups with `groups`, cleaned up, and returns what was saved.
pub fn save(
    store: &GroupsStore,
    groups: Vec<RepositoryGroup>,
) -> Result<RepositoryGroupsDto, StorageError> {
    let groups = clean(groups);
    store.save(&GroupsFile {
        groups: groups.clone(),
    })?;
    Ok(with_missing(groups))
}

fn with_missing(groups: Vec<RepositoryGroup>) -> RepositoryGroupsDto {
    let mut missing: Vec<String> = Vec::new();
    for path in groups.iter().flat_map(|group| &group.repositories) {
        if !Path::new(path).exists() && !missing.iter().any(|known| same_path(known, path)) {
            missing.push(path.clone());
        }
    }
    RepositoryGroupsDto { groups, missing }
}

/// Drops groups with an empty or repeated id and repeated or empty paths; trims names and keeps
/// them within [`MAX_NAME_CHARS`]; caps the counts.
fn clean(groups: Vec<RepositoryGroup>) -> Vec<RepositoryGroup> {
    let mut ids = HashSet::new();
    groups
        .into_iter()
        .filter(|group| !group.id.is_empty() && ids.insert(group.id.clone()))
        .take(MAX_GROUPS)
        .map(|group| {
            let trimmed = group.name.trim();
            let name = if trimmed.is_empty() {
                DEFAULT_NAME.to_owned()
            } else {
                trimmed.chars().take(MAX_NAME_CHARS).collect()
            };
            let mut repositories: Vec<String> = Vec::new();
            for path in group.repositories {
                if !path.is_empty() && !repositories.iter().any(|kept| same_path(kept, &path)) {
                    repositories.push(path);
                }
            }
            repositories.truncate(MAX_REPOSITORIES_PER_GROUP);
            RepositoryGroup {
                name,
                repositories,
                ..group
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn group(id: &str, name: &str, repositories: &[&str]) -> RepositoryGroup {
        RepositoryGroup {
            id: id.to_owned(),
            name: name.to_owned(),
            collapsed: false,
            repositories: repositories.iter().map(|&path| path.to_owned()).collect(),
        }
    }

    #[test]
    fn saves_and_lists_in_order_with_missing_folders_marked() {
        let dir = tempfile::tempdir().unwrap();
        let store = GroupsStore::new(dir.path().join(GROUPS_FILE_NAME));
        assert!(list(&store).unwrap().groups.is_empty(), "no file yet");

        let here = dir.path().to_string_lossy().into_owned();
        let saved = vec![
            group("b", "Work", &[&here, "/no/such/repo"]),
            group("a", "Play", &[]),
        ];
        save(&store, saved.clone()).unwrap();
        let listed = list(&store).unwrap();
        assert_eq!(listed.groups, saved);
        assert_eq!(listed.missing, vec!["/no/such/repo".to_owned()]);
    }

    #[test]
    fn cleans_names_ids_and_repeated_paths() {
        let cleaned = clean(vec![
            group("a", "  Work  ", &["/r/one", "/r/one", "", "/r/two"]),
            group("a", "Same id", &[]),
            group("", "No id", &[]),
            group("c", "   ", &[]),
            group("d", &"x".repeat(MAX_NAME_CHARS + 10), &[]),
        ]);
        let names: Vec<_> = cleaned.iter().map(|group| group.name.as_str()).collect();
        assert_eq!(names.len(), 3);
        assert_eq!(names[0], "Work");
        assert_eq!(names[1], DEFAULT_NAME);
        assert_eq!(names[2].chars().count(), MAX_NAME_CHARS);
        assert_eq!(cleaned[0].repositories, vec!["/r/one", "/r/two"]);
    }
}
