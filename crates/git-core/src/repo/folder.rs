//! What a folder is before a repository is created or cloned there: missing, empty, holding
//! files, or already inside a repository. Only reads the file system; nothing is opened.

use std::path::{Path, PathBuf};

/// What is at the path.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FolderKind {
    /// Nothing yet (`git init` and `git clone` create it).
    Missing,
    /// A file, not a folder.
    File,
    /// A folder without entries.
    Empty,
    /// A folder with files or folders in it.
    Filled,
}

/// A folder about to receive a repository.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FolderState {
    /// What is at the path.
    pub kind: FolderKind,
    /// The repository the folder is in (or would be in, once created): its work tree, or its
    /// git folder when bare. `None` outside any repository.
    pub repository: Option<PathBuf>,
    /// The path is that repository's top folder (or its git folder): creating one there again
    /// would only reinitialize it.
    pub is_repository: bool,
}

/// Describes `path`: what is there, and the repository around it.
pub fn folder_state(path: &Path) -> FolderState {
    let kind = if path.is_file() {
        FolderKind::File
    } else if path.is_dir() {
        let empty = std::fs::read_dir(path).is_ok_and(|mut entries| entries.next().is_none());
        if empty {
            FolderKind::Empty
        } else {
            FolderKind::Filled
        }
    } else {
        FolderKind::Missing
    };
    // A missing folder would be created inside its nearest existing parent.
    let existing = path.ancestors().find(|ancestor| ancestor.is_dir());
    let repository = existing.and_then(repository_around);
    let is_repository = repository
        .as_deref()
        .is_some_and(|top| same_place(top, path) || same_place(&top.join(".git"), path));
    FolderState {
        kind,
        repository,
        is_repository,
    }
}

/// Whether `a` and `b` name the same existing folder (case, `..` and links resolved).
fn same_place(a: &Path, b: &Path) -> bool {
    match (std::fs::canonicalize(a), std::fs::canonicalize(b)) {
        (Ok(a), Ok(b)) => a == b,
        _ => false,
    }
}

/// The repository whose work tree (or git folder) holds `dir`, found as git would.
fn repository_around(dir: &Path) -> Option<PathBuf> {
    let (found, _trust) = gix::discover::upwards(dir).ok()?;
    let (git_dir, work_tree) = found.into_repository_and_work_tree_directories();
    Some(work_tree.unwrap_or(git_dir))
}
