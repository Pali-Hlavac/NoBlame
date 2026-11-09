//! A conflicted file in the built-in merge view. Its three versions are read from the index's
//! stages with gix (1 base, 2 ours, 3 theirs: the versions git merged, as stored, before any
//! line-ending or filter conversion) and merged line by line (`threeway.rs`). The result is
//! saved the way git would have stored it: as a blob (`git hash-object -w --no-filters`), put
//! in the index in place of the three stages (`git update-index --index-info`), and written to
//! the working tree from there (`git checkout`), so filters and line-ending settings apply as
//! for any checkout.

use std::path::Path;

use gix::bstr::ByteSlice;
use gix::index::entry::{Mode, Stage};
use tokio_util::sync::CancellationToken;

use super::OperationError;
use super::conflict::{checked, conflicts};
use super::threeway::{MergeChunk, merge_chunks};
use crate::cli::Git;
use crate::diff::{DiffError, blob_contents};

/// Larger versions are not merged in the view (use the merge tool or a side).
pub const MAX_MERGE_FILE_BYTES: u64 = 8 << 20;
/// Git's test for binary contents looks for a NUL byte in this many leading bytes.
const BINARY_PROBE_BYTES: usize = 8000;
/// The start of a Git LFS pointer file: its versions are pointers, not the contents.
const LFS_POINTER: &[u8] = b"version https://git-lfs.github.com/spec/";
/// Index modes of regular files.
const REGULAR_MODES: [&[u8]; 2] = [b"100644", b"100755"];

/// Why a conflicted file cannot be merged in the view.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Unmergeable {
    /// It has no conflict (any more).
    NoConflict,
    /// One side deleted it: there is nothing to merge line by line.
    OneSided,
    /// A symbolic link or a submodule.
    NotAFile,
    /// A version contains binary data.
    Binary,
    /// A version is not UTF-8 text.
    NotUtf8,
    /// A version is larger than [`MAX_MERGE_FILE_BYTES`].
    TooLarge,
    /// The versions are Git LFS pointers.
    LargeFileStorage,
}

/// The file merged line by line, with what saving needs.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MergeFile {
    /// The merged lines, resolved or conflicting, in order. Every text is UTF-8.
    pub chunks: Vec<MergeChunk>,
    /// Most of our lines end in CRLF (as stored): lines typed in the view get CRLF too.
    pub crlf: bool,
}

/// The conflicted `path` merged line by line, or why that is not possible. Blocking.
pub fn merge_file(
    repo: &gix::Repository,
    path: &[u8],
) -> Result<Result<MergeFile, Unmergeable>, OperationError> {
    let index = repo
        .index_or_empty()
        .map_err(|error| OperationError::Read(error.to_string()))?;
    let entry = |stage| index.entry_by_path_and_stage(path.as_bstr(), stage);
    let (base, ours, theirs) = (entry(Stage::Base), entry(Stage::Ours), entry(Stage::Theirs));
    let (Some(ours), Some(theirs)) = (ours, theirs) else {
        return Ok(Err(if base.is_some() {
            Unmergeable::OneSided
        } else {
            Unmergeable::NoConflict
        }));
    };
    let regular = |mode: Mode| mode == Mode::FILE || mode == Mode::FILE_EXECUTABLE;
    if !regular(ours.mode) || !regular(theirs.mode) || base.is_some_and(|b| !regular(b.mode)) {
        return Ok(Err(Unmergeable::NotAFile));
    }
    let mut versions = Vec::with_capacity(3);
    for id in [base.map(|b| b.id), Some(ours.id), Some(theirs.id)] {
        let data = match id.map(|id| blob_contents(repo, id, MAX_MERGE_FILE_BYTES)) {
            None => Vec::new(),
            Some(Ok(data)) => data,
            Some(Err(DiffError::TooLarge { .. })) => return Ok(Err(Unmergeable::TooLarge)),
            Some(Err(error)) => return Err(OperationError::Read(error.to_string())),
        };
        if let Some(reason) = unmergeable(&data) {
            return Ok(Err(reason));
        }
        versions.push(data);
    }
    let [base, ours, theirs] = <[Vec<u8>; 3]>::try_from(versions)
        .map_err(|_| OperationError::Read("three versions were expected".to_owned()))?;
    Ok(Ok(MergeFile {
        chunks: merge_chunks(&base, &ours, &theirs),
        crlf: mostly_crlf(&ours),
    }))
}

fn unmergeable(data: &[u8]) -> Option<Unmergeable> {
    if data.starts_with(LFS_POINTER) {
        Some(Unmergeable::LargeFileStorage)
    } else if data[..data.len().min(BINARY_PROBE_BYTES)].contains(&0) {
        Some(Unmergeable::Binary)
    } else if std::str::from_utf8(data).is_err() {
        Some(Unmergeable::NotUtf8)
    } else {
        None
    }
}

fn mostly_crlf(data: &[u8]) -> bool {
    let newlines = data.find_iter(b"\n").count();
    let crlf = data.find_iter(b"\r\n").count();
    crlf * 2 > newlines
}

/// Resolves the conflicted `path` in `work_dir` with `content` (as stored: the line endings and
/// encoding of the versions merged): it becomes the staged version, with our side's file mode,
/// and the working tree file is written from it. Refused when `path` has no conflict (any
/// more) or is not a regular file.
pub async fn save_merged(
    git: &Git,
    work_dir: &Path,
    path: &[u8],
    content: &[u8],
    cancel: &CancellationToken,
) -> Result<(), OperationError> {
    let known = conflicts(git, work_dir, cancel).await?;
    let Some(conflict) = known.iter().find(|conflict| conflict.path == path) else {
        return Err(OperationError::NotApplicable(format!(
            "{} has no conflict (any more).",
            path.to_str_lossy()
        )));
    };
    if !REGULAR_MODES.contains(&conflict.mode.as_slice()) {
        return Err(OperationError::NotApplicable(format!(
            "{} is not a regular file.",
            path.to_str_lossy()
        )));
    }
    let hashed = git
        .command()
        .current_dir(work_dir)
        .args(["hash-object", "-w", "--no-filters", "--stdin"])
        .stdin(content)
        .output(cancel)
        .await?;
    let id = checked(hashed)?.stdout.trim().to_owned();
    if id.is_empty() || !id.iter().all(u8::is_ascii_hexdigit) {
        return Err(OperationError::Read(format!(
            "git hash-object printed {:?}",
            id.to_str_lossy()
        )));
    }
    let mut record = conflict.mode.to_vec();
    record.push(b' ');
    record.extend_from_slice(&id);
    record.push(b'\t');
    record.extend_from_slice(path);
    record.push(0);
    let staged = git
        .command()
        .current_dir(work_dir)
        .args(["update-index", "-z", "--index-info"])
        .stdin(record)
        .output(cancel)
        .await?;
    checked(staged)?;
    let written = git
        .command()
        .current_dir(work_dir)
        .arg("checkout")
        .pathspecs_on_stdin(&[path])
        .output(cancel)
        .await?;
    checked(written)?;
    Ok(())
}
