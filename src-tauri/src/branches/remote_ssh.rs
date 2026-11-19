//! The remote editor's SSH key per remote (NoBlame's own setting, `crate::ssh_keys`): read with
//! the remote's settings, chosen or forgotten, moved along by a rename and forgotten with the
//! remote. Keyed by the repository's folder as the jobs open it.

use std::path::{Path, PathBuf};

use super::service::git_dir_or_work_tree;
use crate::error::{AppError, ErrorCode};
use crate::repository::{RepoId, RepoSessions};
use crate::ssh_keys::{SshKeysStore, key_for, rename, set_key};

/// The folder the jobs of repository `id` run in.
fn folder(sessions: &RepoSessions, id: RepoId) -> Result<PathBuf, AppError> {
    Ok(git_dir_or_work_tree(&sessions.get(id)?.repo))
}

/// The key chosen for `remote`, if any.
pub fn key(
    sessions: &RepoSessions,
    store: &SshKeysStore,
    id: RepoId,
    remote: &str,
) -> Option<String> {
    let folder = folder(sessions, id).ok()?;
    key_for(store, &folder, remote)
}

/// Why `key` cannot be an SSH private key file, or None.
fn refused(key: &Path) -> Option<&'static str> {
    if key.extension().is_some_and(|extension| extension == "pub") {
        return Some(
            "That is the public key (.pub). Choose the private key: the same name without .pub.",
        );
    }
    if !key.is_file() {
        return Some("There is no file at that path.");
    }
    None
}

/// Chooses `key` for `remote` (None forgets it).
pub fn choose(
    sessions: &RepoSessions,
    store: &SshKeysStore,
    id: RepoId,
    remote: &str,
    key: Option<String>,
) -> Result<(), AppError> {
    let key = key.filter(|key| !key.trim().is_empty());
    if let Some(key) = &key
        && let Some(reason) = refused(Path::new(key))
    {
        return Err(AppError::new(ErrorCode::InvalidInput, reason));
    }
    let folder = folder(sessions, id)?;
    Ok(set_key(store, &folder, remote, key.as_deref())?)
}

/// After a rename or a removal: the key follows the remote, or goes with it.
pub fn follow(
    sessions: &RepoSessions,
    store: &SshKeysStore,
    id: RepoId,
    old: &str,
    new: Option<&str>,
) {
    let Ok(folder) = folder(sessions, id) else {
        return;
    };
    let result = match new {
        Some(new) => rename(store, &folder, old, new),
        None => set_key(store, &folder, old, None),
    };
    if let Err(error) = result {
        tracing::warn!(%error, "could not update the remote's SSH key");
    }
}
