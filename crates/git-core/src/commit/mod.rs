//! Staging and committing: the first writes NoBlame makes to a repository. Whole files
//! (`stage.rs`), or some of their lines (`partial.rs`, computed in `lines.rs`); what the message
//! box offers (recent messages, the template, the author) is read in `message.rs`.
//!
//! Every write runs the user's `git` (gix only reads), so hooks, signing (`commit.gpgSign`),
//! `commit.cleanup`, filters and the index lock behave exactly as on the command line
//! (`docs/architecture/git-engine.md`). Paths are passed literally (`--literal-pathspecs`) on
//! standard input, so neither patterns in file names nor the length of the list matter.

mod index;
mod lines;
mod message;
mod partial;
mod stage;

use std::path::{Path, PathBuf};

use gix::bstr::BString;
use tokio_util::sync::CancellationToken;

use crate::cli::{Git, GitError, GitOutput};
use crate::diff::DiffError;

pub use index::{IndexEntry, index_entry};
pub use lines::{LineSelection, Take, combine};
pub use message::{
    Identity, RECENT_SCAN_LIMIT, TEMPLATE_MAX_BYTES, Template, author_identity, comment_char,
    commit_template, recent_messages,
};
pub use partial::{PartialChange, discard_lines, stage_lines, unstage_lines};
pub use stage::{discard_paths, stage_all, stage_paths, unstage_all, unstage_paths};

/// Failures while staging or committing.
#[derive(Debug, thiserror::Error)]
pub enum CommitError {
    /// git could not run.
    #[error(transparent)]
    Git(#[from] GitError),
    /// git refused: a hook failed, nothing was staged, the index was locked, ... `output` is
    /// everything git and its hooks printed, for the user to read.
    #[error("{output}")]
    Rejected {
        /// Standard output and standard error, trimmed.
        output: String,
    },
    /// gix could not read the last commit.
    #[error("{0}")]
    Gix(String),
    /// The file (in the index or the working tree) changed since the user saw it, so the lines
    /// chosen there may mean something else now; nothing was written.
    #[error("{0} changed since it was shown")]
    Changed(String),
    /// An author override not written as `Name <email>`; nothing was committed.
    #[error("{0:?} is not written as Name <email>")]
    InvalidAuthor(String),
    /// The file has merge conflicts; it is resolved as a whole, not line by line.
    #[error("{0} has merge conflicts")]
    Conflicted(String),
    /// A version of the file could not be read (too large, not in a partial clone, ...).
    #[error(transparent)]
    Diff(#[from] DiffError),
    /// Writing the working tree file failed.
    #[error("could not write {}: {source}", path.display())]
    Write {
        /// The file.
        path: PathBuf,
        /// The operating system error.
        #[source]
        source: std::io::Error,
    },
}

/// How to commit.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct CommitOptions {
    /// The message, as typed. Bytes: git stores it as given (after `commit.cleanup`).
    pub message: BString,
    /// Replace the last commit (`--amend`) instead of adding one.
    pub amend: bool,
    /// Add a `Signed-off-by` trailer with the committer's name (`--signoff`).
    pub sign_off: bool,
    /// Someone else wrote the change (`--author`); the committer stays the user.
    pub author: Option<Identity>,
    /// Leave out comment lines (`--cleanup=strip`), as git does when the message started from
    /// `commit.template` in its editor. Otherwise the user's `commit.cleanup` applies.
    pub strip_comments: bool,
}

/// What a commit printed: git's summary line and anything its hooks wrote.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CommitOutput {
    /// Standard output and standard error, trimmed.
    pub output: String,
}

/// Commits the staged changes with `git commit --file=-`. Hooks run as usual; when one fails,
/// or there is nothing to commit, the result is [`CommitError::Rejected`] with git's output.
pub async fn commit(
    git: &Git,
    work_dir: &Path,
    options: &CommitOptions,
    cancel: &CancellationToken,
) -> Result<CommitOutput, CommitError> {
    let mut command = git.command().current_dir(work_dir).arg("commit");
    if options.amend {
        command = command.arg("--amend");
    }
    if options.sign_off {
        command = command.arg("--signoff");
    }
    if let Some(author) = &options.author {
        command = command.option("--author", author.to_string());
    }
    if options.strip_comments {
        command = command.arg("--cleanup=strip");
    }
    let output = command
        .arg("--file=-")
        .stdin(options.message.to_vec())
        .output(cancel)
        .await?;
    accepted(&output).map(|output| CommitOutput { output })
}

/// The full message of the commit `HEAD` points at (`None` on a branch without commits), for
/// amending.
pub fn head_message(repo: &gix::Repository) -> Result<Option<BString>, CommitError> {
    let head = repo.head().map_err(CommitError::gix)?;
    let Some(id) = head.id() else {
        return Ok(None);
    };
    let commit = repo.find_commit(id).map_err(CommitError::gix)?;
    let message = commit.message_raw().map_err(CommitError::gix)?;
    Ok(Some(message.to_owned()))
}

/// Everything git printed, when it succeeded; otherwise the same text as the error.
fn accepted(output: &GitOutput) -> Result<String, CommitError> {
    let text = output.combined();
    if output.success() {
        Ok(text)
    } else {
        Err(CommitError::Rejected { output: text })
    }
}

impl CommitError {
    fn gix(error: impl std::fmt::Display) -> Self {
        Self::Gix(error.to_string())
    }
}
