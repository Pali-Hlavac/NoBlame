//! The files of a revision, for the Files module and the file tab: folder listings, the entry
//! at a path, a file shown whole (the diff tab's rows, every line unchanged) and saving a file.

use std::sync::Arc;

use git_core::diff::{DiffOptions, FileDiff, parse_object_id};
use git_core::graph::GraphError;
use git_core::tree::{TreeEntry, TreeEntryKind, TreeListing, entry_at, list_tree, save_blob};
use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::WebviewWindow;
use tauri_plugin_dialog::DialogExt;

use super::{DiffLineDto, FileDiffDto};
use crate::repository::{DiffKey, RepoId, RepoSessions, RepositoryError, blocking};

/// What a tree entry is.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum TreeEntryKindDto {
    /// A folder.
    Folder,
    /// A file.
    File,
    /// A file with the executable bit.
    Executable,
    /// A symbolic link (its contents are the target path).
    Symlink,
    /// A submodule (`id` is its commit).
    Submodule,
}

/// One entry of a folder. The name is for display (non-UTF-8 bytes are replaced).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct TreeEntryDto {
    /// Name in its folder (empty for the root folder).
    pub name: String,
    /// What it is.
    pub kind: TreeEntryKindDto,
    /// Tree, blob or commit id (hex).
    pub id: String,
}

/// The entries of one folder.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct TreeListingDto {
    /// Folders first, then files, by name ignoring case; at most 50,000.
    pub entries: Vec<TreeEntryDto>,
    /// All entries, including those not listed.
    pub total: u32,
}

/// Which file a file view shows.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct FileViewRequestDto {
    /// The file's blob (hex).
    pub blob_id: String,
    /// Its path (its `.gitattributes` and language apply).
    pub path: String,
    /// Colour the code by the language of the path.
    pub syntax: bool,
}

impl From<TreeEntry> for TreeEntryDto {
    fn from(entry: TreeEntry) -> Self {
        Self {
            name: entry.display_name(),
            kind: match entry.kind {
                TreeEntryKind::Folder => TreeEntryKindDto::Folder,
                TreeEntryKind::File => TreeEntryKindDto::File,
                TreeEntryKind::Executable => TreeEntryKindDto::Executable,
                TreeEntryKind::Symlink => TreeEntryKindDto::Symlink,
                TreeEntryKind::Submodule => TreeEntryKindDto::Submodule,
            },
            id: entry.id.to_string(),
        }
    }
}

impl From<TreeListing> for TreeListingDto {
    fn from(listing: TreeListing) -> Self {
        Self {
            entries: listing
                .entries
                .into_iter()
                .map(TreeEntryDto::from)
                .collect(),
            total: u32::try_from(listing.total).unwrap_or(u32::MAX),
        }
    }
}

/// The entry at `path` in the tree of the commit on `row` (`""` is the root folder).
pub async fn tree_entry(
    sessions: &RepoSessions,
    id: RepoId,
    row: u32,
    path: String,
) -> Result<Option<TreeEntryDto>, RepositoryError> {
    let session = sessions.get(id)?;
    let graph = session.graph(false).await?;
    let commit = graph.id_at(row).ok_or(GraphError::RowOutOfRange {
        row,
        rows: graph.row_count(),
    })?;
    let repo = session.repo.clone();
    let entry = blocking(move || entry_at(&repo.local(), commit, path.as_str().into())).await??;
    Ok(entry.map(TreeEntryDto::from))
}

/// The entries of folder `tree` (hex id).
pub async fn folder(
    sessions: &RepoSessions,
    id: RepoId,
    tree: String,
) -> Result<TreeListingDto, RepositoryError> {
    let repo = sessions.get(id)?.repo.clone();
    let tree = parse_object_id(&tree)?;
    let listing = blocking(move || list_tree(&repo.local(), tree)).await??;
    Ok(listing.into())
}

/// Most rows one request may ask for (as for diffs).
const MAX_VIEW_PAGE_ROWS: u32 = 2_000;

async fn viewed(
    sessions: &RepoSessions,
    id: RepoId,
    request: FileViewRequestDto,
) -> Result<Arc<FileDiff>, RepositoryError> {
    let session = sessions.get(id)?;
    let blob = parse_object_id(&request.blob_id)?;
    let key = DiffKey {
        old: None,
        new: Some(blob),
        path: Some(request.path),
        options: DiffOptions::default(),
        syntax: request.syntax,
        whole: true,
    };
    session.file_diff(key).await
}

/// The file a request names, shown whole: kind, sizes and row count.
pub async fn file_view(
    sessions: &RepoSessions,
    id: RepoId,
    request: FileViewRequestDto,
) -> Result<FileDiffDto, RepositoryError> {
    Ok(FileDiffDto::from(&*viewed(sessions, id, request).await?))
}

/// Up to `count` rows of that file from row `start`.
pub async fn file_view_lines(
    sessions: &RepoSessions,
    id: RepoId,
    request: FileViewRequestDto,
    start: u32,
    count: u32,
) -> Result<Vec<DiffLineDto>, RepositoryError> {
    let view = viewed(sessions, id, request).await?;
    let lines = view.lines(start, count.min(MAX_VIEW_PAGE_ROWS));
    Ok(lines.into_iter().map(DiffLineDto::from).collect())
}

/// Asks where to save blob `blob` (proposing `file_name`) and writes it there as stored in the
/// repository. Returns the path written, or `None` when the user cancelled.
pub async fn save_file_as(
    window: &WebviewWindow,
    sessions: &RepoSessions,
    id: RepoId,
    blob: String,
    file_name: String,
) -> Result<Option<String>, RepositoryError> {
    let repo = sessions.get(id)?.repo.clone();
    let blob = parse_object_id(&blob)?;
    let (sender, receiver) = tokio::sync::oneshot::channel();
    window
        .dialog()
        .file()
        .set_parent(window)
        .set_title("Save the file as")
        .set_file_name(file_name)
        .save_file(move |path| {
            // The receiver is gone only if the command was dropped; nothing to tell then.
            let _ = sender.send(path);
        });
    let Some(path) = receiver.await.ok().flatten() else {
        return Ok(None);
    };
    let path = path
        .into_path()
        .map_err(|error| RepositoryError::Task(error.to_string()))?;
    let shown = path.display().to_string();
    blocking(move || save_blob(&repo.local(), blob, &path)).await??;
    Ok(Some(shown))
}
