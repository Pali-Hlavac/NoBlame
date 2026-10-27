//! Errors raised while locating or running `git`.

use std::path::PathBuf;

/// Failure modes of the git CLI runner.
#[derive(Debug, thiserror::Error)]
pub enum GitError {
    /// No usable `git` executable was found.
    #[error("git executable not found (searched {} locations)", searched.len())]
    NotFound {
        /// Every candidate path that was checked, in order.
        searched: Vec<PathBuf>,
    },
    /// The process could not be started (missing file, permissions, ...).
    #[error("could not start {}: {source}", program.display())]
    Spawn {
        /// The executable that failed to start.
        program: PathBuf,
        /// The operating system error.
        #[source]
        source: std::io::Error,
    },
    /// `git` ran but exited with a non-zero status.
    #[error("`{command}` failed ({}): {stderr}", describe_exit(*code))]
    Failed {
        /// The command line, for logs and "equivalent command" displays.
        command: String,
        /// Exit code, or `None` when the process was terminated by a signal.
        code: Option<i32>,
        /// Standard error, decoded lossily for display.
        stderr: String,
    },
    /// The caller cancelled the command; the process was killed.
    #[error("`{command}` was cancelled")]
    Cancelled {
        /// The command line that was cancelled.
        command: String,
    },
    /// A value would have been read by git as an option or is otherwise malformed.
    #[error("invalid argument {value:?}: {reason}")]
    InvalidArgument {
        /// The rejected value, decoded lossily.
        value: String,
        /// Why it was rejected.
        reason: &'static str,
    },
    /// `git --version` printed something we do not understand.
    #[error("unexpected output from `git --version`: {0:?}")]
    UnparseableVersion(String),
    /// Reading from or writing to the process failed.
    #[error("i/o error while talking to git: {0}")]
    Io(#[from] std::io::Error),
}

fn describe_exit(code: Option<i32>) -> String {
    code.map_or_else(
        || "terminated by a signal".to_owned(),
        |code| format!("exit code {code}"),
    )
}
