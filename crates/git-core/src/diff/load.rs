//! Reading the two blobs of a file diff from the repository.

use gix::ObjectId;
use gix::diff::blob::Algorithm;

use super::DiffError;
use super::file::{FileDiff, diff_blobs};
use super::lines::DiffContent;
use super::options::DiffOptions;

/// Larger files are not compared; their sizes are shown instead.
pub const MAX_DIFF_BLOB_BYTES: u64 = 64 << 20;

/// The diff between blobs `old` and `new`; `None` is an absent side (an added or deleted
/// file). Blocking: reads both blobs and diffs them.
pub fn file_diff(
    repo: &gix::Repository,
    old: Option<ObjectId>,
    new: Option<ObjectId>,
    options: DiffOptions,
) -> Result<FileDiff, DiffError> {
    let (old_size, new_size) = (blob_size(repo, old)?, blob_size(repo, new)?);
    if old_size.max(new_size) > MAX_DIFF_BLOB_BYTES {
        return Ok(FileDiff::sizes_only(
            DiffContent::TooLarge,
            old_size,
            new_size,
        ));
    }
    // Git's own default when the setting is missing or invalid.
    let algorithm = repo.diff_algorithm().unwrap_or(Algorithm::Myers);
    Ok(diff_blobs(
        read_blob(repo, old)?,
        read_blob(repo, new)?,
        algorithm,
        options,
    ))
}

fn blob_size(repo: &gix::Repository, id: Option<ObjectId>) -> Result<u64, DiffError> {
    let Some(id) = id else { return Ok(0) };
    let header = repo.find_header(id).map_err(|error| {
        // Partial clones (`--filter=blob:none`) lack old file contents until git fetches them.
        if error.classify().is_not_found() {
            DiffError::Missing(id)
        } else {
            DiffError::gix(error)
        }
    })?;
    if header.kind() != gix::object::Kind::Blob {
        return Err(DiffError::NotAFile(id));
    }
    Ok(header.size())
}

fn read_blob(repo: &gix::Repository, id: Option<ObjectId>) -> Result<Vec<u8>, DiffError> {
    let Some(id) = id else { return Ok(Vec::new()) };
    Ok(repo.find_blob(id).map_err(DiffError::gix)?.take_data())
}
