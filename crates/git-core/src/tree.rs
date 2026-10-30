//! The files of a revision: one folder at a time ([`list_tree`]), so a tree of 100,000 files
//! costs only the folders someone opens; the entry at a path ([`entry_at`]); and saving a file
//! ([`save_blob`]). In-process with gix; nothing here starts `git`.

use std::cmp::Ordering;
use std::path::{Path, PathBuf};

use gix::ObjectId;
use gix::bstr::{BStr, BString, ByteSlice};
use gix::object::tree::EntryKind;

/// Entries returned at most for one folder (folders first, so none of those is left out).
pub const MAX_TREE_ENTRIES: usize = 50_000;

/// Failures while reading trees or saving a file.
#[derive(Debug, thiserror::Error)]
pub enum TreeError {
    /// gix could not read the objects.
    #[error("{0}")]
    Gix(String),
    /// The object is not in the local repository (for example in a partial clone).
    #[error("object {0} is not in the local repository")]
    Missing(ObjectId),
    /// Writing the saved file failed.
    #[error("could not write {path}: {source}")]
    Write {
        /// Where the file was to be saved.
        path: PathBuf,
        /// Why it failed.
        source: std::io::Error,
    },
}

impl TreeError {
    fn gix(error: impl std::fmt::Display) -> Self {
        Self::Gix(error.to_string())
    }
}

/// What a tree entry is.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TreeEntryKind {
    /// A folder (a tree).
    Folder,
    /// A file.
    File,
    /// A file with the executable bit.
    Executable,
    /// A symbolic link; its contents are the target path.
    Symlink,
    /// A submodule: a commit of another repository.
    Submodule,
}

impl From<EntryKind> for TreeEntryKind {
    fn from(kind: EntryKind) -> Self {
        match kind {
            EntryKind::Tree => Self::Folder,
            EntryKind::Blob => Self::File,
            EntryKind::BlobExecutable => Self::Executable,
            EntryKind::Link => Self::Symlink,
            EntryKind::Commit => Self::Submodule,
        }
    }
}

/// One entry of a folder.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TreeEntry {
    /// Its name in the folder. Bytes: may be non-UTF-8.
    pub name: BString,
    /// What it is.
    pub kind: TreeEntryKind,
    /// The tree, blob or (for a submodule) commit it points at.
    pub id: ObjectId,
}

impl TreeEntry {
    /// The name for display (lossy for non-UTF-8 bytes).
    pub fn display_name(&self) -> String {
        self.name.to_str_lossy().into_owned()
    }
}

/// The entries of one folder.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TreeListing {
    /// Folders first, then files, each by name ignoring case; at most [`MAX_TREE_ENTRIES`].
    pub entries: Vec<TreeEntry>,
    /// All entries, including those not listed.
    pub total: usize,
}

/// The entries of tree `id`. Trees are content-addressed, so a listing never changes.
pub fn list_tree(repo: &gix::Repository, id: ObjectId) -> Result<TreeListing, TreeError> {
    let tree = repo
        .find_tree(id)
        .map_err(|error| missing_or_gix(error, id))?;
    let mut entries = Vec::new();
    for entry in tree.iter() {
        let entry = entry.map_err(TreeError::gix)?;
        entries.push(TreeEntry {
            name: entry.filename().to_owned(),
            kind: entry.kind().into(),
            id: entry.object_id(),
        });
    }
    entries.sort_by(display_order);
    let total = entries.len();
    entries.truncate(MAX_TREE_ENTRIES);
    Ok(TreeListing { entries, total })
}

/// The entry at `path` (`/`-separated, relative to the root) in `commit`'s tree, or `None` if
/// the commit has nothing there. The empty path is the root folder (with an empty name).
pub fn entry_at(
    repo: &gix::Repository,
    commit: ObjectId,
    path: &BStr,
) -> Result<Option<TreeEntry>, TreeError> {
    let commit = repo.find_commit(commit).map_err(TreeError::gix)?;
    let tree = commit.tree().map_err(TreeError::gix)?;
    let components: Vec<&[u8]> = path
        .split_str("/")
        .filter(|component| !component.is_empty())
        .collect();
    if components.is_empty() {
        return Ok(Some(TreeEntry {
            name: BString::default(),
            kind: TreeEntryKind::Folder,
            id: tree.id,
        }));
    }
    let entry = tree
        .lookup_entry(components.into_iter().map(BString::from))
        .map_err(TreeError::gix)?;
    Ok(entry.map(|entry| TreeEntry {
        name: entry.filename().to_owned(),
        kind: entry.mode().kind().into(),
        id: entry.object_id(),
    }))
}

/// Writes the contents of blob `id` to `destination` exactly as the repository stores them
/// (no line-ending conversion or other filters), replacing the file there. Returns the number
/// of bytes written. Blocking.
pub fn save_blob(
    repo: &gix::Repository,
    id: ObjectId,
    destination: &Path,
) -> Result<u64, TreeError> {
    let blob = repo
        .find_blob(id)
        .map_err(|error| missing_or_gix(error, id))?;
    std::fs::write(destination, &blob.data).map_err(|source| TreeError::Write {
        path: destination.to_owned(),
        source,
    })?;
    Ok(blob.data.len() as u64)
}

/// Folders before everything else, then by name ignoring ASCII case, then by the exact bytes.
fn display_order(a: &TreeEntry, b: &TreeEntry) -> Ordering {
    let folder = |entry: &TreeEntry| entry.kind != TreeEntryKind::Folder;
    folder(a)
        .cmp(&folder(b))
        .then_with(|| {
            let (a_name, b_name): (&[u8], &[u8]) = (a.name.as_ref(), b.name.as_ref());
            a_name
                .iter()
                .map(u8::to_ascii_lowercase)
                .cmp(b_name.iter().map(u8::to_ascii_lowercase))
        })
        .then_with(|| a.name.cmp(&b.name))
}

fn missing_or_gix(error: gix::Error, id: ObjectId) -> TreeError {
    // Partial clones (`--filter=blob:none` or `tree:0`) lack objects until git fetches them.
    if error.classify().is_not_found() {
        TreeError::Missing(id)
    } else {
        TreeError::gix(error)
    }
}
