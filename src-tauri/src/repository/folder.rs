//! `inspect_folder`: what a folder is before the Create repository and Clone windows put a
//! repository there (missing, empty, holding files, inside a repository already).

use std::path::PathBuf;

use git_core::repo::{FolderKind, folder_state};
use serde::Serialize;
use specta::Type;

use super::blocking;
use crate::error::CommandResult;

/// What is at a path.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum FolderKindDto {
    /// Nothing yet: it will be created.
    Missing,
    /// A file.
    File,
    /// An empty folder.
    Empty,
    /// A folder with files or folders in it.
    Filled,
}

impl From<FolderKind> for FolderKindDto {
    fn from(kind: FolderKind) -> Self {
        match kind {
            FolderKind::Missing => Self::Missing,
            FolderKind::File => Self::File,
            FolderKind::Empty => Self::Empty,
            FolderKind::Filled => Self::Filled,
        }
    }
}

/// A folder about to receive a repository.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct FolderStateDto {
    /// What is there.
    pub kind: FolderKindDto,
    /// The repository it is (or would be) inside: its top folder, for display (non-UTF-8 parts
    /// replaced); `null` outside any repository.
    pub repository: Option<String>,
    /// The path is that repository's top folder: it is a repository already.
    pub is_repository: bool,
}

/// What `path` is, and the repository around it. Nothing is opened or changed.
#[tauri::command]
#[specta::specta]
pub async fn inspect_folder(path: String) -> CommandResult<FolderStateDto> {
    let state = blocking(move || folder_state(&PathBuf::from(path))).await?;
    Ok(FolderStateDto {
        kind: state.kind.into(),
        repository: state
            .repository
            .map(|repository| repository.to_string_lossy().into_owned()),
        is_repository: state.is_repository,
    })
}
