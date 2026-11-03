//! Low-level index writes for partial changes, all through the git CLI: reading a file's index
//! entry, storing new contents as a blob, pointing the index at it, and turning a blob into
//! the bytes the working tree file should hold (smudge filters, line endings).

use std::borrow::Cow;
use std::path::{Path, PathBuf};

use gix::ObjectId;
use gix::bstr::{BStr, ByteSlice};
use tokio_util::sync::CancellationToken;

use super::{CommitError, accepted};
use crate::cli::Git;

/// Mode of an ordinary file, for files new to the index.
pub const REGULAR_FILE_MODE: u32 = 0o100_644;
/// Mode of an executable file.
pub const EXECUTABLE_FILE_MODE: u32 = 0o100_755;

/// A file's entry in the index.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct IndexEntry {
    /// File mode, e.g. `0o100644`.
    pub mode: u32,
    /// The staged blob.
    pub id: ObjectId,
}

/// The index entry of the file at `path` (`git ls-files --stage`), `None` when the index has
/// none. A conflicted file (several stages) is refused: it is resolved, not partly staged.
pub async fn index_entry(
    git: &Git,
    work_dir: &Path,
    path: &BStr,
    cancel: &CancellationToken,
) -> Result<Option<IndexEntry>, CommitError> {
    let output = git
        .command()
        .current_dir(work_dir)
        .read_only()
        .literal_pathspecs()
        .args(["ls-files", "--stage", "-z"])
        .paths([os_path(path)?])
        .run(cancel)
        .await?;
    let mut found = None;
    for record in output.stdout.split(|&byte| byte == 0) {
        // `<mode> <id> <stage>\t<path>`
        let Some((info, entry_path)) = record.split_once_str("\t") else {
            continue;
        };
        if entry_path != path.as_bytes() {
            continue;
        }
        let mut fields = info.split(|&byte| byte == b' ');
        let (Some(mode), Some(id), Some(stage)) = (fields.next(), fields.next(), fields.next())
        else {
            continue;
        };
        if stage != b"0" {
            return Err(CommitError::Conflicted(path.to_string()));
        }
        let mode = std::str::from_utf8(mode)
            .ok()
            .and_then(|mode| u32::from_str_radix(mode, 8).ok());
        let id = ObjectId::from_hex(id).ok();
        if let (Some(mode), Some(id)) = (mode, id) {
            found = Some(IndexEntry { mode, id });
        }
    }
    Ok(found)
}

/// Stores `data` as a blob exactly as given (`git hash-object -w --no-filters`); returns its
/// id.
pub async fn write_blob(
    git: &Git,
    work_dir: &Path,
    data: Vec<u8>,
    cancel: &CancellationToken,
) -> Result<ObjectId, CommitError> {
    let output = git
        .command()
        .current_dir(work_dir)
        .args(["hash-object", "-w", "--no-filters", "--stdin"])
        .stdin(data)
        .output(cancel)
        .await?;
    let text = accepted(&output)?;
    ObjectId::from_hex(text.trim().as_bytes()).map_err(|_| CommitError::Rejected { output: text })
}

/// Points the index entry at `path` to `entry` (`git update-index --index-info`), adding it
/// when the index has none.
pub async fn set_index_entry(
    git: &Git,
    work_dir: &Path,
    path: &BStr,
    entry: IndexEntry,
    cancel: &CancellationToken,
) -> Result<(), CommitError> {
    let mut input = format!("{:o} {}\t", entry.mode, entry.id).into_bytes();
    input.extend_from_slice(path);
    input.push(0);
    let output = git
        .command()
        .current_dir(work_dir)
        .args(["update-index", "-z", "--index-info"])
        .stdin(input)
        .output(cancel)
        .await?;
    accepted(&output).map(drop)
}

/// The bytes the working tree file at `path` holds for blob `id`: smudge filters run and line
/// endings converted, as a checkout would write them (`git cat-file --filters`).
pub async fn checkout_form(
    git: &Git,
    work_dir: &Path,
    path: &BStr,
    id: ObjectId,
    cancel: &CancellationToken,
) -> Result<Vec<u8>, CommitError> {
    let output = git
        .command()
        .current_dir(work_dir)
        .read_only()
        .args(["cat-file", "--filters"])
        .option("--path", os_path(path)?.as_os_str())
        .revision(&id.to_string())?
        .output(cancel)
        .await?;
    if output.success() {
        Ok(output.stdout)
    } else {
        accepted(&output).map(|_| Vec::new())
    }
}

/// `path` as the operating system's path type (relative to the working tree).
pub(super) fn os_path(path: &BStr) -> Result<PathBuf, CommitError> {
    gix::path::from_bstr(Cow::Borrowed(path))
        .map(Cow::into_owned)
        .map_err(|_| CommitError::Rejected {
            output: format!("{path} is not a valid path on this system"),
        })
}
