//! Staging, unstaging and discarding some of a file's changed lines (a hunk, or lines picked one
//! by one). The new contents are computed here ([`combine`]) and written with git: as a blob the
//! index points at, or, for a discard, as the working tree file a checkout would write.
//!
//! The versions the user saw are named by their ids; when the index or the file changed since,
//! nothing is written ([`CommitError::Changed`]).

use std::path::PathBuf;

use gix::ObjectId;
use gix::bstr::{BStr, BString};
use gix::diff::blob::Algorithm;
use tokio_util::sync::CancellationToken;

use super::index::{
    EXECUTABLE_FILE_MODE, IndexEntry, REGULAR_FILE_MODE, checkout_form, index_entry,
    set_index_entry, write_blob,
};
use super::lines::{LineSelection, Take, combine};
use super::{CommitError, unstage_paths};
use crate::cli::Git;
use crate::diff::{DiffError, MAX_DIFF_BLOB_BYTES, blob_contents, worktree_version};
use crate::tree::entry_at;

/// Some changed lines of one file, between the two versions the user saw.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PartialChange {
    /// Path in the working tree (`/`-separated).
    pub path: BString,
    /// The old version's blob: the index's for changes in the working tree, `HEAD`'s for staged
    /// changes; `None` when the file is not there.
    pub old: Option<ObjectId>,
    /// The new version: the working tree file's id, or the index's blob for staged changes.
    pub new: ObjectId,
    /// The changed lines to stage, unstage or discard.
    pub selection: LineSelection,
}

/// Stages the chosen lines of a working tree file: the index gets its version with only those
/// changes made.
pub async fn stage_lines(
    git: &Git,
    repo: gix::Repository,
    change: PartialChange,
) -> Result<(), CommitError> {
    let (work_dir, cancel) = (work_dir(&repo)?, CancellationToken::new());
    let entry = index_entry(git, &work_dir, change.path.as_ref(), &cancel).await?;
    expect(&change, entry.map(|entry| entry.id), change.old)?;
    let path = change.path.clone();
    let (contents, executable) = blocking(move || {
        let new = worktree_contents(&repo, &change)?;
        let old = blob(&repo, change.old)?;
        let contents = combine(
            &old,
            &new,
            algorithm(&repo),
            &change.selection,
            Take::Chosen,
        );
        Ok((contents, is_executable(&repo, change.path.as_ref())))
    })
    .await?;
    let mode = entry.map_or(
        if executable {
            EXECUTABLE_FILE_MODE
        } else {
            REGULAR_FILE_MODE
        },
        |entry| entry.mode,
    );
    let id = write_blob(git, &work_dir, contents, &cancel).await?;
    set_index_entry(
        git,
        &work_dir,
        path.as_ref(),
        IndexEntry { mode, id },
        &cancel,
    )
    .await
}

/// Unstages the chosen lines of a staged file: the index gets its version with those changes
/// undone. When nothing staged is left, the file is unstaged whole (`git reset`).
pub async fn unstage_lines(
    git: &Git,
    repo: gix::Repository,
    change: PartialChange,
) -> Result<(), CommitError> {
    let (work_dir, cancel) = (work_dir(&repo)?, CancellationToken::new());
    let path = change.path.clone();
    let Some(entry) = index_entry(git, &work_dir, path.as_ref(), &cancel).await? else {
        return Err(CommitError::Changed(path.to_string()));
    };
    expect(&change, Some(entry.id), Some(change.new))?;
    let contents = blocking(move || {
        let head = head_blob(&repo, change.path.as_ref())?;
        expect(&change, head, change.old)?;
        let old = blob(&repo, change.old)?;
        let new = blob(&repo, Some(change.new))?;
        let contents = combine(
            &old,
            &new,
            algorithm(&repo),
            &change.selection,
            Take::AllButChosen,
        );
        Ok((contents != old).then_some(contents))
    })
    .await?;
    match contents {
        Some(contents) => {
            let id = write_blob(git, &work_dir, contents, &cancel).await?;
            let entry = IndexEntry { id, ..entry };
            set_index_entry(git, &work_dir, path.as_ref(), entry, &cancel).await
        }
        None => unstage_paths(git, &work_dir, &[path], &cancel).await,
    }
}

/// Throws away the chosen changed lines of a working tree file: it gets the index's lines back
/// there, written as a checkout would write them. Cannot be undone.
pub async fn discard_lines(
    git: &Git,
    repo: gix::Repository,
    change: PartialChange,
) -> Result<(), CommitError> {
    let (work_dir, cancel) = (work_dir(&repo)?, CancellationToken::new());
    let path = change.path.clone();
    let entry = index_entry(git, &work_dir, path.as_ref(), &cancel).await?;
    expect(&change, entry.map(|entry| entry.id), change.old)?;
    let contents = blocking(move || {
        let new = worktree_contents(&repo, &change)?;
        let old = blob(&repo, change.old)?;
        let contents = combine(
            &old,
            &new,
            algorithm(&repo),
            &change.selection,
            Take::AllButChosen,
        );
        Ok((contents != new).then_some(contents))
    })
    .await?;
    let Some(contents) = contents else {
        return Ok(());
    };
    let id = write_blob(git, &work_dir, contents, &cancel).await?;
    let bytes = checkout_form(git, &work_dir, path.as_ref(), id, &cancel).await?;
    let file = work_dir.join(super::index::os_path(path.as_ref())?);
    std::fs::write(&file, bytes).map_err(|source| CommitError::Write { path: file, source })
}

/// Fails with [`CommitError::Changed`] unless `found` is the version the user saw.
fn expect(
    change: &PartialChange,
    found: Option<ObjectId>,
    seen: Option<ObjectId>,
) -> Result<(), CommitError> {
    if found == seen {
        Ok(())
    } else {
        Err(CommitError::Changed(change.path.to_string()))
    }
}

fn work_dir(repo: &gix::Repository) -> Result<PathBuf, CommitError> {
    repo.workdir()
        .map(PathBuf::from)
        .ok_or_else(|| CommitError::Rejected {
            output: "the repository has no working tree".to_owned(),
        })
}

/// The working tree file as git would store it, if it is still the version the user saw.
fn worktree_contents(
    repo: &gix::Repository,
    change: &PartialChange,
) -> Result<Vec<u8>, CommitError> {
    let file =
        worktree_version(repo, change.path.as_ref(), change.new).map_err(|error| match error {
            DiffError::Changed(path) => CommitError::Changed(path),
            other => CommitError::Diff(other),
        })?;
    file.data.ok_or(CommitError::Diff(DiffError::TooLarge {
        size: file.size,
        limit: MAX_DIFF_BLOB_BYTES,
    }))
}

fn blob(repo: &gix::Repository, id: Option<ObjectId>) -> Result<Vec<u8>, CommitError> {
    match id {
        Some(id) => Ok(blob_contents(repo, id, MAX_DIFF_BLOB_BYTES)?),
        None => Ok(Vec::new()),
    }
}

/// The blob `HEAD` has at `path`; `None` when it has none (or there is no commit yet).
fn head_blob(repo: &gix::Repository, path: &BStr) -> Result<Option<ObjectId>, CommitError> {
    let head = repo.head().map_err(CommitError::gix)?;
    let Some(commit) = head.id() else {
        return Ok(None);
    };
    let entry = entry_at(repo, commit.detach(), path).map_err(CommitError::gix)?;
    Ok(entry.map(|entry| entry.id))
}

fn algorithm(repo: &gix::Repository) -> Algorithm {
    // Git's own default when the setting is missing or invalid.
    repo.diff_algorithm().unwrap_or(Algorithm::Myers)
}

/// Whether a file new to the index should be staged as executable.
#[cfg(unix)]
fn is_executable(repo: &gix::Repository, path: &BStr) -> bool {
    use std::os::unix::fs::PermissionsExt;
    let Some(work_dir) = repo.workdir() else {
        return false;
    };
    let Ok(relative) = super::index::os_path(path) else {
        return false;
    };
    std::fs::metadata(work_dir.join(relative))
        .is_ok_and(|metadata| metadata.permissions().mode() & 0o111 != 0)
}

/// Windows has no executable bit; git stores new files as regular files there.
#[cfg(not(unix))]
fn is_executable(_repo: &gix::Repository, _path: &BStr) -> bool {
    false
}

/// Runs reading and comparing (gix, CPU) off the async runtime's threads.
async fn blocking<T: Send + 'static>(
    work: impl FnOnce() -> Result<T, CommitError> + Send + 'static,
) -> Result<T, CommitError> {
    tokio::task::spawn_blocking(work)
        .await
        .map_err(|error| CommitError::Gix(error.to_string()))?
}
