//! What a commit changed: the list of files ([`commit_changes`]) and the line diff of one file
//! ([`file_diff`]). Both run in-process with gix; nothing here starts `git`.

mod changes;
mod file;
mod lines;
mod load;
mod options;
mod rows;
mod split;
mod text;

pub use changes::{ChangeStatus, ChangedFile, CommitChanges, MAX_CHANGED_FILES, commit_changes};
pub use file::FileDiff;
pub use lines::{DiffContent, DiffLine, LineKind, SplitCell, SplitLine};
pub use load::{MAX_DIFF_BLOB_BYTES, file_diff};
pub use options::{DiffOptions, WHOLE_FILE_CONTEXT, Whitespace};
pub use rows::CONTEXT_LINES;
pub use text::MAX_LINE_BYTES;

/// Blob and commit ids, re-exported so callers need no gix dependency.
pub use gix::ObjectId;

/// Failures while diffing.
#[derive(Debug, thiserror::Error)]
pub enum DiffError {
    /// gix could not read or diff the objects.
    #[error("{0}")]
    Gix(String),
    /// The commit has fewer parents than asked for.
    #[error("the commit has no parent number {0}")]
    NoSuchParent(usize),
    /// An object id that is not a valid hexadecimal id.
    #[error("{0:?} is not an object id")]
    InvalidId(String),
    /// The object is not in the local repository (for example in a partial clone).
    #[error("object {0} is not in the local repository")]
    Missing(ObjectId),
    /// The object is a tree, commit or tag where a file's contents were expected.
    #[error("object {0} is not a file")]
    NotAFile(ObjectId),
}

impl DiffError {
    fn gix(error: impl std::fmt::Display) -> Self {
        Self::Gix(error.to_string())
    }
}

/// Parses a full hexadecimal object id, as the UI sends blob ids back.
pub fn parse_object_id(hex: &str) -> Result<ObjectId, DiffError> {
    ObjectId::from_hex(hex.as_bytes()).map_err(|_| DiffError::InvalidId(hex.to_owned()))
}

#[cfg(test)]
mod options_tests;
#[cfg(test)]
mod tests;
