//! Running the user's `git` executable safely.
//!
//! - [`locate`] finds the executable (override, `PATH`, well-known install locations).
//! - [`Git`] is a located executable; [`Git::command`] starts a [`GitCommand`].
//! - [`GitCommand`] only accepts literal flags, `--name=value` options, validated revisions
//!   and paths after `--`, so user input is never read as an option. It always runs with a
//!   fixed locale, no terminal prompts and no console window, and can be cancelled.

mod args;
mod command;
mod error;
mod git;
pub mod locate;
mod output;
mod run;
mod version;

pub use args::validate_revision;
pub use command::GitCommand;
pub use error::GitError;
pub use git::Git;
pub use output::GitOutput;
pub use version::{GitVersion, MIN_GIT_VERSION};
