//! The SSH key chosen for a remote in the remote editor. git has no per-remote key setting
//! (`core.sshCommand` is per repository), so this is NoBlame's own, kept in
//! `remote-ssh-keys.json` by repository folder and remote name, and passed as
//! `GIT_SSH_COMMAND` (`<ssh> -i <key> -o IdentitiesOnly=yes`) when a job talks to that remote.
//! A terminal does not see it. See ADR 0024.

use std::path::Path;

use serde::{Deserialize, Serialize};
use tauri::{App, Manager};

use crate::repository::same_path;
use crate::storage::{JsonFile, StorageError};

/// File name of the store inside the app config directory.
pub const FILE_NAME: &str = "remote-ssh-keys.json";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Entry {
    /// The repository's folder (work tree, or the repository when bare).
    repository: String,
    remote: String,
    /// The private key file.
    key: String,
}

/// The saved document.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SshKeys {
    keys: Vec<Entry>,
}

/// Managed state holding the keys.
pub type SshKeysStore = JsonFile<SshKeys>;

/// Registers the store.
pub fn init(app: &App) -> tauri::Result<()> {
    let config = crate::storage::profile::config_dir(app)?;
    app.manage(SshKeysStore::new(config.join(FILE_NAME)));
    Ok(())
}

fn matches(entry: &Entry, repository: &Path, remote: &str) -> bool {
    entry.remote == remote && same_path(&entry.repository, &repository.display().to_string())
}

/// The key chosen for `remote` of the repository at `repository`.
pub fn key_for(store: &SshKeysStore, repository: &Path, remote: &str) -> Option<String> {
    let file = store
        .load()
        .inspect_err(|error| tracing::warn!(%error, "could not read the remote SSH keys"))
        .ok()?;
    file.keys
        .into_iter()
        .find(|entry| matches(entry, repository, remote))
        .map(|entry| entry.key)
}

/// Chooses `key` for `remote` (None forgets it).
pub fn set_key(
    store: &SshKeysStore,
    repository: &Path,
    remote: &str,
    key: Option<&str>,
) -> Result<(), StorageError> {
    let mut file = store.load()?;
    file.keys
        .retain(|entry| !matches(entry, repository, remote));
    if let Some(key) = key {
        file.keys.push(Entry {
            repository: repository.display().to_string(),
            remote: remote.to_owned(),
            key: key.to_owned(),
        });
    }
    store.save(&file)
}

/// Moves the key of a renamed remote along.
pub fn rename(
    store: &SshKeysStore,
    repository: &Path,
    old: &str,
    new: &str,
) -> Result<(), StorageError> {
    match key_for(store, repository, old) {
        Some(key) => {
            set_key(store, repository, old, None)?;
            set_key(store, repository, new, Some(&key))
        }
        None => Ok(()),
    }
}

/// `GIT_SSH_COMMAND` using `key` on top of the ssh command git would use (`base`, from
/// `GIT_SSH_COMMAND` or `core.sshCommand`; plain `ssh` otherwise). git runs it through a shell:
/// the path is quoted, with `/` separators.
pub fn ssh_command(key: &str, base: Option<&str>) -> String {
    let key = key.replace('\\', "/").replace('"', "\\\"");
    format!(
        "{} -i \"{key}\" -o IdentitiesOnly=yes",
        base.filter(|base| !base.trim().is_empty()).unwrap_or("ssh")
    )
}

#[cfg(test)]
mod tests {
    #![allow(clippy::unwrap_used)]
    use std::path::Path;

    use super::{SshKeysStore, key_for, rename, set_key, ssh_command};

    #[test]
    fn keeps_a_key_per_repository_and_remote() {
        let dir = tempfile::tempdir().unwrap();
        let store = SshKeysStore::new(dir.path().join("keys.json"));
        let repo = Path::new("C:/code/app");
        set_key(&store, repo, "origin", Some("C:/keys/work")).unwrap();
        assert_eq!(
            key_for(&store, repo, "origin").as_deref(),
            Some("C:/keys/work")
        );
        assert_eq!(key_for(&store, repo, "upstream"), None);
        assert_eq!(key_for(&store, Path::new("C:/code/other"), "origin"), None);

        rename(&store, repo, "origin", "github").unwrap();
        assert_eq!(key_for(&store, repo, "origin"), None);
        assert_eq!(
            key_for(&store, repo, "github").as_deref(),
            Some("C:/keys/work")
        );
        set_key(&store, repo, "github", None).unwrap();
        assert_eq!(key_for(&store, repo, "github"), None);
    }

    #[test]
    fn builds_the_ssh_command() {
        assert_eq!(
            ssh_command(r"C:\Users\ada\.ssh\id_work", None),
            "ssh -i \"C:/Users/ada/.ssh/id_work\" -o IdentitiesOnly=yes"
        );
        assert_eq!(
            ssh_command("/home/ada/.ssh/k", Some("ssh -p 2222")),
            "ssh -p 2222 -i \"/home/ada/.ssh/k\" -o IdentitiesOnly=yes"
        );
    }
}
