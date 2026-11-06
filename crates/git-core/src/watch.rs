//! Watching a repository for changes made outside the app (a commit in a terminal, an editor
//! saving a file, a fetch).
//!
//! File system events are debounced, then sorted by [`classify`] into "refs changed" (the graph,
//! branches and stashes need reloading), "working tree changed" (the status needs reading) and
//! "config changed" (upstreams of branches).
//! Changes to ignored files are dropped using the repository's own `.gitignore` rules, so a
//! build writing into `target/` or `node_modules/` does not cause status runs.

use std::path::{Path, PathBuf};
use std::time::Duration;

use notify::RecursiveMode;
use notify_debouncer_mini::{DebounceEventResult, Debouncer, new_debouncer};

/// Quiet time after the last event before changes are reported. Git operations touch many
/// files (index, refs, logs) in quick succession; this reports them once.
pub const DEBOUNCE: Duration = Duration::from_millis(300);

/// What changed since the last report.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct Changes {
    /// HEAD, a branch, a tag, a remote branch or the stash moved.
    pub refs: bool,
    /// A file in the working tree or the index changed.
    pub work_tree: bool,
    /// The repository's config changed (upstreams of branches, remotes).
    pub config: bool,
}

impl Changes {
    fn add(&mut self, kind: ChangeKind) {
        match kind {
            ChangeKind::Refs => self.refs = true,
            ChangeKind::WorkTree => self.work_tree = true,
            ChangeKind::Config => self.config = true,
        }
    }

    fn any(self) -> bool {
        self.refs || self.work_tree || self.config
    }
}

/// The kind of one changed path.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ChangeKind {
    /// References or HEAD.
    Refs,
    /// The index or a file in the working tree (not yet checked against `.gitignore`).
    WorkTree,
    /// `config` or `config.worktree` in `.git`.
    Config,
}

/// The folders of one repository.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WatchPaths {
    /// `.git` of this work tree (holds HEAD and the index).
    pub git_dir: PathBuf,
    /// Shared `.git` of all linked work trees (holds refs); the same as `git_dir` usually.
    pub common_dir: PathBuf,
    /// The working tree; `None` for a bare repository.
    pub work_dir: Option<PathBuf>,
}

impl WatchPaths {
    /// The folders of `repo`.
    pub fn of(repo: &crate::repo::Repository) -> Self {
        let local = repo.local();
        Self {
            git_dir: local.git_dir().to_path_buf(),
            common_dir: local.common_dir().to_path_buf(),
            work_dir: local.workdir().map(Path::to_path_buf),
        }
    }

    /// The same folders with symlinks resolved; a folder that cannot be resolved stays as is.
    #[cfg_attr(not(target_os = "macos"), allow(dead_code))]
    fn canonical(&self) -> Self {
        let resolve = |path: &PathBuf| std::fs::canonicalize(path).unwrap_or_else(|_| path.clone());
        Self {
            git_dir: resolve(&self.git_dir),
            common_dir: resolve(&self.common_dir),
            work_dir: self.work_dir.as_ref().map(resolve),
        }
    }
}

/// Failures to start watching.
#[derive(Debug, thiserror::Error)]
#[error("cannot watch the repository: {0}")]
pub struct WatchError(#[from] notify::Error);

/// Sorts one changed path, or `None` when it does not matter (objects, logs, lock files).
pub fn classify(paths: &WatchPaths, path: &Path) -> Option<ChangeKind> {
    for dir in [&paths.git_dir, &paths.common_dir] {
        if let Ok(relative) = path.strip_prefix(dir) {
            return classify_git_file(relative);
        }
    }
    let work_dir = paths.work_dir.as_ref()?;
    path.strip_prefix(work_dir)
        .ok()
        .map(|_| ChangeKind::WorkTree)
}

fn classify_git_file(relative: &Path) -> Option<ChangeKind> {
    let first = relative.components().next()?.as_os_str();
    if relative
        .extension()
        .is_some_and(|extension| extension == "lock")
    {
        return None;
    }
    if first == "index" {
        Some(ChangeKind::WorkTree)
    } else if first == "HEAD" || first == "packed-refs" || first == "refs" {
        Some(ChangeKind::Refs)
    } else if first == "config" || first == "config.worktree" {
        Some(ChangeKind::Config)
    } else {
        None
    }
}

/// A running watcher; dropping it stops watching.
pub struct RepoWatcher {
    _debouncer: Debouncer<notify::RecommendedWatcher>,
}

impl std::fmt::Debug for RepoWatcher {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str("RepoWatcher")
    }
}

impl RepoWatcher {
    /// Watches `paths` and calls `on_change` (on a background thread) after each burst of
    /// changes. `is_ignored` receives working tree paths relative to the work dir and drops
    /// ignored ones; [`gitignore_filter`] builds one from the repository.
    pub fn start(
        paths: WatchPaths,
        is_ignored: impl Fn(&[PathBuf]) -> Vec<bool> + Send + 'static,
        on_change: impl Fn(Changes) + Send + 'static,
    ) -> Result<Self, WatchError> {
        // FSEvents reports resolved paths (`/private/var/...` for `/var/...`).
        #[cfg(target_os = "macos")]
        let paths = paths.canonical();
        let roots = watch_roots(&paths);
        let mut debouncer = new_debouncer(DEBOUNCE, move |result: DebounceEventResult| {
            let Ok(events) = result else { return };
            let mut changes = Changes::default();
            let mut work_files = Vec::new();
            for event in events {
                match classify(&paths, &event.path) {
                    Some(ChangeKind::WorkTree) if !is_git_internal(&paths, &event.path) => {
                        if let Some(work_dir) = &paths.work_dir
                            && let Ok(relative) = event.path.strip_prefix(work_dir)
                        {
                            work_files.push(relative.to_path_buf());
                        }
                    }
                    Some(kind) => changes.add(kind),
                    None => {}
                }
            }
            if !work_files.is_empty() && is_ignored(&work_files).iter().any(|ignored| !ignored) {
                changes.work_tree = true;
            }
            if changes.any() {
                on_change(changes);
            }
        })?;
        for root in roots {
            debouncer.watcher().watch(&root, RecursiveMode::Recursive)?;
        }
        Ok(Self {
            _debouncer: debouncer,
        })
    }
}

/// Paths under the git dirs are classified as git files, never as working tree files.
fn is_git_internal(paths: &WatchPaths, path: &Path) -> bool {
    path.starts_with(&paths.git_dir) || path.starts_with(&paths.common_dir)
}

/// The fewest folders that cover the work tree and both git dirs (a folder inside another one
/// is covered by the recursive watch on the outer one).
fn watch_roots(paths: &WatchPaths) -> Vec<PathBuf> {
    let mut roots: Vec<PathBuf> = Vec::new();
    let candidates = paths
        .work_dir
        .iter()
        .chain([&paths.common_dir, &paths.git_dir]);
    for dir in candidates {
        if roots.iter().any(|root| dir.starts_with(root)) {
            continue;
        }
        roots.retain(|root| !root.starts_with(dir));
        roots.push(dir.clone());
    }
    roots
}

mod ignore;

pub use ignore::gitignore_filter;

#[cfg(test)]
mod tests;
