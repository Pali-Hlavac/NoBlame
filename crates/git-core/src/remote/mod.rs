//! Talking to remotes: fetch (`fetch.rs`), reading git's progress lines (`progress.rs`) and
//! what an askpass prompt asks for (`prompt.rs`), hiding credentials in URLs (`redact.rs`).
//! These commands run as background jobs: the caller streams the command
//! ([`GitCommand::stream`](crate::cli::GitCommand::stream)), feeds each line to
//! [`parse_progress`] and keeps the rest as the job's log.

mod fetch;
mod progress;
mod prompt;
mod redact;

pub use fetch::{FetchOptions, FetchSummary, FetchTarget, fetch_command, summarize_fetch};
pub use progress::{Progress, parse_progress};
pub use prompt::{PromptKind, classify_prompt};
pub use redact::redact_credentials;
