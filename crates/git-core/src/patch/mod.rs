//! Patches and archives. Creating patches of a commit or a range (`git format-patch`, into one
//! file or one file per commit: `create.rs`); reading what a patch file holds (mails with their
//! subjects, or a plain diff: `mailbox.rs`); checking and applying patches (`git apply`, with a
//! three-way merge when needed, or `git am` to make commits: `apply.rs`); and the command that
//! saves an archive of a revision (`git archive`, zip or tar.gz: `archive.rs`).
//! Files go after `--`, so none is read as an option.

mod apply;
mod archive;
mod create;
mod mailbox;

use std::io;
use std::path::PathBuf;

use crate::cli::GitError;

pub use apply::{
    AmOutcome, ApplyOutcome, MAX_LISTED_PATHS, PatchCheck, PatchFit, PatchedPath, apply_mailbox,
    apply_patches, check_patches, parse_numstat,
};
pub use archive::{ArchiveFormat, archive_command, archive_prefix};
pub use create::{
    MAX_PATCH_COMMITS, PatchCommits, PatchCount, count_patches, write_patch_file,
    write_patch_folder,
};
pub use mailbox::{
    MAX_PATCH_READ_BYTES, PatchContents, PatchMail, decode_header, parse_patch, read_patch_file,
};

/// Failures of creating, checking and applying patches, and of archives.
#[derive(Debug, thiserror::Error)]
pub enum PatchError {
    /// git could not run, or a value cannot be passed to it.
    #[error(transparent)]
    Git(#[from] GitError),
    /// git refused; `output` is what it said.
    #[error("{output}")]
    Rejected {
        /// Standard output and standard error, trimmed.
        output: String,
    },
    /// A file or folder could not be read or written.
    #[error("{}: {source}", path.display())]
    Io {
        /// The file or folder.
        path: PathBuf,
        /// Why.
        source: io::Error,
    },
    /// What was asked cannot be done (a revision that does not exist, files in the way).
    #[error("{0}")]
    Invalid(String),
}

impl PatchError {
    fn io(path: impl Into<PathBuf>) -> impl FnOnce(io::Error) -> Self {
        let path = path.into();
        move |source| Self::Io { path, source }
    }
}
