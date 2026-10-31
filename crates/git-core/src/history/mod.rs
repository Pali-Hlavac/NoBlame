//! The history of one file or folder, following renames. `git log -- <path>` lists the commits
//! that change the path, with git's history simplification and its changed-path Bloom filters.
//! Where a commit added the file (or a merge brought it from a side that had another name),
//! gix's rename detection finds the old name, and the history goes on under it from that
//! parent. Unlike `git log --follow` (four to fifteen times slower on git.git, ADR 0022), each
//! side of a merge keeps its own name.

mod log;

use std::collections::{HashSet, VecDeque};
use std::path::Path;

use gix::ObjectId;
use gix::bstr::{BStr, BString, ByteSlice};
use gix::object::tree::EntryMode;
use gix::object::tree::diff::ChangeDetached;
use tokio_util::sync::CancellationToken;

use crate::cli::{Git, GitError};
use log::path_log;

/// Renames followed at most, so a file renamed back and forth cannot keep the walk going.
pub const MAX_RENAMES: usize = 64;

/// Failures while reading a history.
#[derive(Debug, thiserror::Error)]
pub enum HistoryError {
    /// `git log` failed or was cancelled.
    #[error(transparent)]
    Git(#[from] GitError),
    /// gix could not read the objects.
    #[error("{0}")]
    Gix(String),
    /// A blocking task failed.
    #[error("{0}")]
    Task(String),
}

/// How a commit changed the path.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PathChange {
    /// The path was created.
    Added,
    /// The contents (or the files in the folder) changed.
    Modified,
    /// The path was removed.
    Deleted,
    /// The file was renamed to this path; [`HistoryEntry::previous`] names the old one.
    Renamed,
    /// A merge that differs from every parent at the path (git shows no file list for it).
    Merge,
}

/// One commit of the history.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HistoryEntry {
    /// The commit.
    pub id: ObjectId,
    /// Index into [`FileHistory::paths`]: the name the file has in this commit.
    pub path: usize,
    /// What the commit did to it.
    pub change: PathChange,
    /// For [`PathChange::Renamed`], index of the name it had before.
    pub previous: Option<usize>,
}

/// Why the history stops before the first commit of the file.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum HistoryStop {
    /// [`MAX_RENAMES`] renames were followed.
    TooManyRenames,
    /// Finding where the file came from needs contents that are not in the local repository
    /// (a partial clone); the history ends at this commit.
    MissingContents(ObjectId),
}

/// The commits that change a path, newest name first.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FileHistory {
    /// In the order found: each name's commits as `git log` lists them, then older names.
    pub entries: Vec<HistoryEntry>,
    /// The names of the file; the first is the path asked for.
    pub paths: Vec<BString>,
    /// Set when renames were not followed to the end.
    pub stopped: Option<HistoryStop>,
}

/// The history of `path` (relative to the top of the working tree, `/`-separated, taken
/// literally) reachable from `tips`. Renames of a file are followed; a folder's are not.
pub async fn file_history(
    git: &Git,
    dir: &Path,
    repo: &gix::ThreadSafeRepository,
    tips: &[ObjectId],
    first_parent: bool,
    path: &BStr,
    cancel: &CancellationToken,
) -> Result<FileHistory, HistoryError> {
    let mut history = FileHistory {
        entries: Vec::new(),
        paths: vec![path.to_owned()],
        stopped: None,
    };
    let mut seen = HashSet::new();
    let mut names = VecDeque::from([(0, tips.to_vec())]);
    while let Some((name, starts)) = names.pop_front() {
        let log = path_log(
            git,
            dir,
            &starts,
            first_parent,
            history.paths[name].as_bstr(),
            cancel,
        )
        .await?;
        let mut candidates = Vec::new();
        for (id, change) in log {
            if !seen.insert(id) {
                continue;
            }
            if matches!(change, PathChange::Added | PathChange::Merge) {
                candidates.push((history.entries.len(), id));
            }
            history.entries.push(HistoryEntry {
                id,
                path: name,
                change,
                previous: None,
            });
        }
        let (repo, path) = (repo.clone(), history.paths[name].clone());
        let found = tokio::task::spawn_blocking(move || {
            let repo = repo.to_thread_local();
            candidates
                .into_iter()
                .map(|(index, id)| {
                    (
                        index,
                        rename_sources(&repo, id, path.as_ref(), first_parent),
                    )
                })
                .collect::<Vec<_>>()
        })
        .await
        .map_err(|error| HistoryError::Task(error.to_string()))?;
        for (index, sources) in found {
            let sources = match sources {
                Ok(sources) => sources,
                Err(error) if error.classify().is_not_found() => {
                    let id = history.entries[index].id;
                    history.stopped = Some(HistoryStop::MissingContents(id));
                    continue;
                }
                Err(error) => return Err(HistoryError::Gix(error.to_string())),
            };
            for (parent, old_path) in sources {
                // Topic branches merged after a rename all lead to the old name: one walk.
                let waiting = names
                    .iter_mut()
                    .find(|(name, _)| history.paths[*name] == old_path);
                let name = if let Some((name, starts)) = waiting {
                    starts.push(parent);
                    *name
                } else if history.paths.len() > MAX_RENAMES {
                    history.stopped = Some(HistoryStop::TooManyRenames);
                    break;
                } else {
                    names.push_back((history.paths.len(), vec![parent]));
                    history.paths.push(old_path);
                    history.paths.len() - 1
                };
                let entry = &mut history.entries[index];
                if entry.change == PathChange::Added {
                    entry.change = PathChange::Renamed;
                    entry.previous = Some(name);
                }
            }
        }
    }
    Ok(history)
}

/// Where the file at `path` in `commit` came from, for each parent that does not have it (the
/// parent of a commit that added it, the side of a merge that had another name): the parent
/// and the file's name there. Rename detection is always on here, whatever `diff.renames` says.
fn rename_sources(
    repo: &gix::Repository,
    commit: ObjectId,
    path: &BStr,
    first_parent: bool,
) -> Result<Vec<(ObjectId, BString)>, gix::Error> {
    let commit = repo.find_commit(commit)?;
    let new_tree = commit.tree()?;
    if lookup(&new_tree, path)?.is_none_or(|mode| mode.is_tree()) {
        return Ok(Vec::new());
    }
    let parents = commit.parent_ids().map(gix::Id::detach);
    let parents: Vec<ObjectId> = parents
        .take(if first_parent { 1 } else { usize::MAX })
        .collect();
    let mut sources = Vec::new();
    for parent in parents {
        let old_tree = repo.find_commit(parent)?.tree()?;
        if lookup(&old_tree, path)?.is_some() {
            continue;
        }
        let options =
            gix::diff::Options::default().with_rewrites(Some(gix::diff::Rewrites::default()));
        let changes = repo.diff_tree_to_tree(&old_tree, &new_tree, options)?;
        sources.extend(changes.into_iter().find_map(|change| match change {
            ChangeDetached::Rewrite {
                source_location,
                location,
                copy: false,
                ..
            } if location == path => Some((parent, source_location)),
            _ => None,
        }));
    }
    Ok(sources)
}

/// The mode of the entry at `path` in `tree`, if there is one.
fn lookup(tree: &gix::Tree<'_>, path: &BStr) -> Result<Option<EntryMode>, gix::Error> {
    let components = path
        .split_str("/")
        .filter(|part| !part.is_empty())
        .map(BString::from);
    Ok(tree.lookup_entry(components)?.map(|entry| entry.mode()))
}
