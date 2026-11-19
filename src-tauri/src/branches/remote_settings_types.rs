//! What the remote editor reads and saves. Values cross IPC with secrets hidden
//! (`git_core::config::redact_value`); the backend puts them back when a value is saved
//! unchanged.

use git_core::config::{KeyChange, Scope, ScopedEntry, has_password, redact_key, redact_value};
use git_core::remote::{HeadChange, RemoteEdit};
use serde::{Deserialize, Serialize};
use specta::Type;

/// Where a value is set.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum ConfigScopeNameDto {
    /// The installation's settings.
    System,
    /// The user's (`~/.gitconfig`).
    Global,
    /// The repository's own (`.git/config`); the only one the editor writes.
    Local,
    /// The worktree's own (`config.worktree`).
    Worktree,
}

impl From<Scope> for ConfigScopeNameDto {
    fn from(scope: Scope) -> Self {
        match scope {
            Scope::System => Self::System,
            Scope::Global => Self::Global,
            Scope::Local => Self::Local,
            Scope::Worktree => Self::Worktree,
        }
    }
}

/// One value of a setting with where it is set; secrets hidden.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ConfigValueDto {
    /// The key as git lists it: section and name in lower case (`remote.origin.pushurl`).
    pub key: String,
    /// The value, a password or header secret shown as `***`.
    pub value: String,
    pub scope: ConfigScopeNameDto,
    /// The file it is set in, as git names it.
    pub file: Option<String>,
    /// Whether a password is written in it (the editor offers to move it to the helper).
    pub secret: bool,
}

impl From<ScopedEntry> for ConfigValueDto {
    fn from(entry: ScopedEntry) -> Self {
        let value = redact_value(&entry.key, &entry.value);
        Self {
            secret: value != entry.value || has_password(&entry.key),
            key: redact_key(&entry.key),
            value,
            scope: entry.scope.into(),
            file: entry.file,
        }
    }
}

/// A remote's settings as the editor shows them.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct RemoteSettingsDto {
    pub name: String,
    /// The branch its default branch (`refs/remotes/<name>/HEAD`) points at.
    pub head: Option<String>,
    /// Its remote branches here, sorted.
    pub branches: Vec<String>,
    /// The local branches, sorted (one may be set to track the remote).
    pub local_branches: Vec<String>,
    /// Whether the repository uses Git LFS (the editor shows its LFS tab).
    pub uses_lfs: bool,
    /// The SSH private key NoBlame uses for this remote (its own setting), if one is chosen.
    pub ssh_key: Option<String>,
    /// The settings the editor shows (remotes, URL rewrites, branches, push, pull, fetch, HTTP,
    /// credentials, LFS) of every scope, in the order git reads them.
    pub entries: Vec<ConfigValueDto>,
}

/// One key's values before (as shown) and after.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct KeyChangeDto {
    pub key: String,
    pub before: Vec<String>,
    pub after: Vec<String>,
}

/// The default branch before and after (`null`: none).
#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct HeadChangeDto {
    pub before: Option<String>,
    pub after: Option<String>,
}

/// What the editor saves for one remote.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct RemoteEditDto {
    /// The remote's name now.
    pub name: String,
    /// Its name after, when it changes.
    pub new_name: Option<String>,
    pub head: Option<HeadChangeDto>,
    pub keys: Vec<KeyChangeDto>,
}

impl From<RemoteEditDto> for RemoteEdit {
    fn from(edit: RemoteEditDto) -> Self {
        Self {
            name: edit.name,
            new_name: edit.new_name,
            head: edit.head.map(|head| HeadChange {
                before: head.before,
                after: head.after,
            }),
            keys: edit
                .keys
                .into_iter()
                .map(|key| KeyChange {
                    key: key.key,
                    before: key.before,
                    after: key.after,
                })
                .collect(),
        }
    }
}
