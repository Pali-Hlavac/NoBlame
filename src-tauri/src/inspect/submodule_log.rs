//! The diff tab of a submodule: the commits between its old and new pointer, read in the
//! submodule's own clone (`git_core::submodule::pointer_log`).

use git_core::cli::Git;
use git_core::diff::parse_object_id;
use git_core::submodule::{PointerChange, PointerCommit, pointer_log, submodule_dir};
use serde::Serialize;
use specta::Type;
use tauri::State;
use tokio_util::sync::CancellationToken;

use crate::error::CommandResult;
use crate::git_env::GitEnvError;
use crate::repository::{RepoId, RepoSessions, RepositoryError};

/// A commit between two pointers.
#[derive(Debug, Clone, PartialEq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct PointerCommitDto {
    /// Full id.
    pub id: String,
    /// The first line of its message.
    pub summary: String,
    /// Author name.
    pub author: String,
    /// Author time, seconds since the epoch.
    pub time: f64,
}

impl From<PointerCommit> for PointerCommitDto {
    fn from(commit: PointerCommit) -> Self {
        Self {
            id: commit.id,
            summary: commit.summary,
            author: commit.author,
            #[allow(clippy::cast_precision_loss)]
            time: commit.time as f64,
        }
    }
}

/// The commits between two pointers, newest first on each side (at most 200 each).
#[derive(Debug, Clone, PartialEq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct PointerLogDto {
    /// The new pointer's commit (what is checked out, for the working tree).
    pub to: String,
    /// Commits the new pointer has and the old one does not.
    pub added: Vec<PointerCommitDto>,
    /// Commits the old pointer had and the new one does not.
    pub removed: Vec<PointerCommitDto>,
    /// More were added than listed.
    pub more_added: bool,
    /// More were removed than listed.
    pub more_removed: bool,
}

/// What the diff tab says about a submodule's pointer change.
#[derive(Debug, Clone, PartialEq, Serialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum SubmoduleLogDto {
    /// The submodule is not checked out here: its commits cannot be read.
    NotCheckedOut,
    /// Its clone does not have one of the commits (not fetched yet).
    Missing,
    /// The commits between the pointers.
    Log(PointerLogDto),
}

/// The commits between `from` and `to` (hex; `null`: what the submodule has checked out) of
/// the submodule at `path` in the repository's work tree.
pub async fn submodule_log(
    sessions: &RepoSessions,
    id: RepoId,
    path: String,
    from: String,
    to: Option<String>,
) -> Result<SubmoduleLogDto, RepositoryError> {
    let session = sessions.get(id)?;
    let work_dir = session
        .repo
        .info()
        .work_dir
        .clone()
        .ok_or(RepositoryError::Bare)?;
    let dir = submodule_dir(&work_dir, &path)?;
    // Only ids: the clone's branch names mean nothing to the superproject.
    let from = parse_object_id(&from)?.to_string();
    let to = match to {
        Some(to) => parse_object_id(&to)?.to_string(),
        None => "HEAD".to_owned(),
    };
    let git = Git::locate().map_err(GitEnvError::from)?;
    let change = pointer_log(&git, &dir, &from, &to, &CancellationToken::new()).await?;
    Ok(match change {
        PointerChange::NotCheckedOut => SubmoduleLogDto::NotCheckedOut,
        PointerChange::Missing => SubmoduleLogDto::Missing,
        PointerChange::Log(log) => SubmoduleLogDto::Log(PointerLogDto {
            to: log.to,
            added: log.added.into_iter().map(Into::into).collect(),
            removed: log.removed.into_iter().map(Into::into).collect(),
            more_added: log.more_added,
            more_removed: log.more_removed,
        }),
    })
}

/// The commits between two pointers of the submodule at `path`: `from` (hex) and `to` (hex, or
/// `null` for what the submodule has checked out). Read in the submodule's own clone.
#[tauri::command]
#[specta::specta]
pub async fn get_submodule_log(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    path: String,
    from: String,
    to: Option<String>,
) -> CommandResult<SubmoduleLogDto> {
    Ok(submodule_log(&sessions, id, path, from, to).await?)
}
