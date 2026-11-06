//! Talking to remotes: fetch (`fetch.rs`) and reading git's progress lines (`progress.rs`).
//! These commands run as background jobs: the caller streams the command
//! ([`GitCommand::stream`](crate::cli::GitCommand::stream)), feeds each line to
//! [`parse_progress`] and keeps the rest as the job's log.

mod fetch;
mod progress;

pub use fetch::{FetchOptions, FetchSummary, FetchTarget, fetch_command, summarize_fetch};
pub use progress::{Progress, parse_progress};
