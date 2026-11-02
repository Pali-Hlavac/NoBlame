//! A working tree file as git would store it: line endings converted and clean filters run
//! (`core.autocrlf`, `.gitattributes`), so it compares with the index as `git diff` does. Its
//! blob id names the contents, like a blob's, although it is not in the object database.

use std::io::Read;
use std::path::{Component, Path, PathBuf};
use std::sync::atomic::AtomicBool;

use gix::ObjectId;
use gix::bstr::BStr;
use gix::filter::plumbing::pipeline::convert::ToGitOutcome;

use super::DiffError;
use super::file::{FileDiff, diff_blobs};
use super::lines::DiffContent;
use super::load::{MAX_DIFF_BLOB_BYTES, blob_size, read_blob};
use super::options::DiffOptions;

/// A file of the working tree.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WorktreeFile {
    /// The id git would give it (`git hash-object`).
    pub id: ObjectId,
    /// Size as stored, in bytes (on disk for files over [`MAX_DIFF_BLOB_BYTES`]).
    pub size: u64,
    /// The contents as stored; `None` for files over [`MAX_DIFF_BLOB_BYTES`], which are hashed
    /// as they are on disk instead of being read and converted.
    pub data: Option<Vec<u8>>,
}

/// The file at `path` (`/`-separated, relative to the working tree); `None` when nothing or a
/// folder is there. Paths that leave the working tree are refused. Blocking.
pub fn read_worktree_file(
    repo: &gix::Repository,
    path: &BStr,
) -> Result<Option<WorktreeFile>, DiffError> {
    let relative = relative_path(path)?;
    let Some(work_dir) = repo.workdir() else {
        return Ok(None);
    };
    let full = work_dir.join(&relative);
    let metadata = match std::fs::symlink_metadata(&full) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(DiffError::gix(error)),
    };
    let data = if metadata.is_symlink() {
        // git stores a link as the path it points to.
        let target = std::fs::read_link(&full).map_err(DiffError::gix)?;
        gix::path::into_bstr(target)
            .map_err(DiffError::gix)?
            .into_owned()
            .into()
    } else if metadata.is_dir() {
        return Ok(None);
    } else if metadata.len() > MAX_DIFF_BLOB_BYTES {
        return large_file(repo, &full, metadata.len()).map(Some);
    } else {
        converted(repo, &full, &relative)?
    };
    let id = gix::objs::compute_hash(repo.object_hash(), gix::object::Kind::Blob, &data)
        .map_err(DiffError::gix)?;
    Ok(Some(WorktreeFile {
        id,
        size: data.len() as u64,
        data: Some(data),
    }))
}

/// The working tree file at `path` if it is still the version `expected` names;
/// [`DiffError::Changed`] when it changed or went away since. Blocking.
pub fn worktree_version(
    repo: &gix::Repository,
    path: &BStr,
    expected: ObjectId,
) -> Result<WorktreeFile, DiffError> {
    read_worktree_file(repo, path)?
        .filter(|file| file.id == expected)
        .ok_or_else(|| DiffError::Changed(path.to_string()))
}

/// The diff between blob `old` (`None`: absent) and the working tree file `new`. Blocking.
pub fn worktree_diff(
    repo: &gix::Repository,
    old: Option<ObjectId>,
    new: WorktreeFile,
    options: DiffOptions,
) -> Result<FileDiff, DiffError> {
    let old_size = blob_size(repo, old)?;
    let Some(data) = new.data.filter(|_| old_size <= MAX_DIFF_BLOB_BYTES) else {
        return Ok(FileDiff::sizes_only(
            DiffContent::TooLarge,
            old_size,
            new.size,
        ));
    };
    let algorithm = repo
        .diff_algorithm()
        .unwrap_or(gix::diff::blob::Algorithm::Myers);
    Ok(diff_blobs(read_blob(repo, old)?, data, algorithm, options))
}

/// `path` as a relative file system path with only normal components.
fn relative_path(path: &BStr) -> Result<PathBuf, DiffError> {
    let refused = || DiffError::Gix(format!("{path} is not a path inside the working tree"));
    let relative = gix::path::from_bstr(path)
        .map_err(|_| refused())?
        .into_owned();
    let normal = relative
        .components()
        .all(|component| matches!(component, Component::Normal(_)));
    if !normal || relative.as_os_str().is_empty() {
        return Err(refused());
    }
    Ok(relative)
}

/// Reads the file at `full` and converts it as `git add` would.
fn converted(repo: &gix::Repository, full: &Path, relative: &Path) -> Result<Vec<u8>, DiffError> {
    let file = std::fs::File::open(full).map_err(DiffError::gix)?;
    let (mut pipeline, index) = repo.filter_pipeline(None).map_err(DiffError::gix)?;
    let mut data = Vec::new();
    match pipeline
        .convert_to_git(file, relative, &index)
        .map_err(DiffError::gix)?
    {
        ToGitOutcome::Unchanged(mut reader) => reader.read_to_end(&mut data),
        ToGitOutcome::Process(mut reader) => reader.read_to_end(&mut data),
        ToGitOutcome::Buffer(buffer) => {
            data.extend_from_slice(buffer);
            Ok(buffer.len())
        }
    }
    .map_err(DiffError::gix)?;
    Ok(data)
}

/// A file too large to compare: hashed as it is on disk, without reading it into memory.
fn large_file(repo: &gix::Repository, full: &Path, size: u64) -> Result<WorktreeFile, DiffError> {
    let mut file = std::fs::File::open(full).map_err(DiffError::gix)?;
    let id = gix::objs::compute_stream_hash(
        repo.object_hash(),
        gix::object::Kind::Blob,
        &mut file,
        size,
        &mut gix::progress::Discard,
        &AtomicBool::new(false),
    )
    .map_err(DiffError::gix)?;
    Ok(WorktreeFile {
        id,
        size,
        data: None,
    })
}
