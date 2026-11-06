//! Tauri boundary for the working tree.

use tauri::State;

use super::partial::{self, LineAction};
use super::staging::{self, Scope};
use super::types::{CommitDefaultsDto, CommitRequestDto, CommitResultDto, LineChangeDto};
use super::{ChangeCountsDto, WorkingTreeStatusDto, message, service};
use crate::error::CommandResult;
use crate::repository::{RawBytes, RepoId, RepoSessions};

/// The working tree status: counts, staged files and unstaged ones (`null` for a bare
/// repository).
#[tauri::command]
#[specta::specta]
pub async fn get_status(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
) -> CommandResult<Option<WorkingTreeStatusDto>> {
    Ok(service::status(&sessions, id).await?)
}

/// The uncommitted files of the repository at `path`, open or not, counted once each as new,
/// changed or deleted (`null` for a bare repository). Runs `git status`.
#[tauri::command]
#[specta::specta]
pub async fn get_change_counts(path: String) -> CommandResult<Option<ChangeCountsDto>> {
    Ok(service::change_counts(path).await?)
}

/// The blob id the working tree file at `path` would have (`git hash-object`); `null` when
/// nothing or a folder is there. Diffs and previews of the file name it by this id.
#[tauri::command]
#[specta::specta]
pub async fn get_worktree_file_id(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    path: String,
) -> CommandResult<Option<String>> {
    Ok(service::file_id(&sessions, id, path).await?)
}

/// The contents of the working tree file at `path` (at most 32 MB), for previews such as
/// images, if it is still the version `blob_id` names.
#[tauri::command]
#[specta::specta]
pub async fn get_worktree_file_contents(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    path: String,
    blob_id: String,
) -> CommandResult<RawBytes> {
    Ok(service::file_contents(&sessions, id, path, blob_id).await?)
}

/// Stages the files at `paths` as they are in the working tree (changes, new files,
/// deletions; a conflicted file is marked resolved).
#[tauri::command]
#[specta::specta]
pub async fn stage_files(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    paths: Vec<String>,
) -> CommandResult<()> {
    Ok(staging::stage(&sessions, id, Scope::Paths(paths)).await?)
}

/// Stages every change in the working tree.
#[tauri::command]
#[specta::specta]
pub async fn stage_all_files(sessions: State<'_, RepoSessions>, id: RepoId) -> CommandResult<()> {
    Ok(staging::stage(&sessions, id, Scope::All).await?)
}

/// Unstages the files at `paths` (both names of a rename); the working tree is not touched.
#[tauri::command]
#[specta::specta]
pub async fn unstage_files(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    paths: Vec<String>,
) -> CommandResult<()> {
    Ok(staging::unstage(&sessions, id, Scope::Paths(paths)).await?)
}

/// Unstages everything; the working tree is not touched.
#[tauri::command]
#[specta::specta]
pub async fn unstage_all_files(sessions: State<'_, RepoSessions>, id: RepoId) -> CommandResult<()> {
    Ok(staging::unstage(&sessions, id, Scope::All).await?)
}

/// Commits the staged changes (or amends the last commit). Hooks run; when git refuses, the
/// error's message is everything git and its hooks printed.
#[tauri::command]
#[specta::specta]
pub async fn create_commit(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    request: CommitRequestDto,
) -> CommandResult<CommitResultDto> {
    Ok(staging::create_commit(&sessions, id, request).await?)
}

/// The message of the commit HEAD points at (`null` before the first commit), for amending.
#[tauri::command]
#[specta::specta]
pub async fn get_head_message(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
) -> CommandResult<Option<String>> {
    Ok(staging::last_message(&sessions, id).await?)
}

/// What the message box needs: the configured author, `commit.template` and comment character.
#[tauri::command]
#[specta::specta]
pub async fn get_commit_defaults(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
) -> CommandResult<CommitDefaultsDto> {
    Ok(message::defaults(&sessions, id).await?)
}

/// The newest distinct messages of the user's own commits (up to 20, looking at most 2,000
/// commits back from HEAD).
#[tauri::command]
#[specta::specta]
pub async fn get_recent_messages(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
) -> CommandResult<Vec<String>> {
    Ok(message::recent(&sessions, id).await?)
}

/// Stages the chosen changed lines of a working tree file (a hunk, or single lines).
#[tauri::command]
#[specta::specta]
pub async fn stage_lines(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    request: LineChangeDto,
) -> CommandResult<()> {
    Ok(partial::change_lines(&sessions, id, LineAction::Stage, request).await?)
}

/// Unstages the chosen changed lines of a staged file.
#[tauri::command]
#[specta::specta]
pub async fn unstage_lines(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    request: LineChangeDto,
) -> CommandResult<()> {
    Ok(partial::change_lines(&sessions, id, LineAction::Unstage, request).await?)
}

/// Throws away the chosen changed lines of a working tree file. Cannot be undone.
#[tauri::command]
#[specta::specta]
pub async fn discard_lines(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    request: LineChangeDto,
) -> CommandResult<()> {
    Ok(partial::change_lines(&sessions, id, LineAction::Discard, request).await?)
}

/// Throws away the working tree changes of `tracked` files (back to the staged version) and
/// deletes the `untracked` files. Cannot be undone.
#[tauri::command]
#[specta::specta]
pub async fn discard_files(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    tracked: Vec<String>,
    untracked: Vec<String>,
) -> CommandResult<()> {
    Ok(partial::discard_files(&sessions, id, tracked, untracked).await?)
}
