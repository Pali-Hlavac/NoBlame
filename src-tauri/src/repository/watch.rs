//! Watching open repositories and telling the main window what changed.

use git_core::repo::Repository;
use git_core::watch::{RepoWatcher, WatchPaths, gitignore_filter};
use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::AppHandle;
use tauri_specta::Event;

use super::RepoId;

/// A repository changed outside the app. The frontend reloads the graph (and everything read
/// from it) for `refs`, and re-reads the status for `workTree`. A missed event is harmless:
/// the status is also read when the window regains focus.
#[derive(Debug, Clone, Serialize, Deserialize, Type, tauri_specta::Event)]
#[serde(rename_all = "camelCase")]
pub struct RepositoryChanged {
    /// The session.
    pub id: RepoId,
    /// HEAD, a branch, a tag, a remote branch or the stash moved.
    pub refs: bool,
    /// A file in the working tree or the index changed.
    pub work_tree: bool,
}

/// Starts watching `repo` for session `id`. Failing to watch (for example the inotify limit
/// on Linux) is logged, not fatal: the window still refreshes when it regains focus.
pub fn start(app: &AppHandle, id: RepoId, repo: &Repository) -> Option<RepoWatcher> {
    let app = app.clone();
    let watcher = RepoWatcher::start(
        WatchPaths::of(repo),
        gitignore_filter(repo.thread_safe()),
        move |changes| {
            let event = RepositoryChanged {
                id,
                refs: changes.refs,
                work_tree: changes.work_tree,
            };
            if let Err(error) = event.emit(&app) {
                tracing::warn!(%error, "could not report a repository change");
            }
        },
    );
    match watcher {
        Ok(watcher) => Some(watcher),
        Err(error) => {
            tracing::warn!(%error, id, "not watching the repository");
            None
        }
    }
}
