//! Talking to remotes: fetch (`fetch.rs`), pull (`pull.rs`), push (`push.rs`), the remote
//! names (`remotes.rs`), reading git's progress lines (`progress.rs`) and
//! what an askpass prompt asks for (`prompt.rs`), hiding credentials in URLs (`redact.rs`).
//! These commands run as background jobs: the caller streams the command
//! ([`GitCommand::stream`](crate::cli::GitCommand::stream)), feeds each line to
//! [`parse_progress`] and keeps the rest as the job's log.

mod fetch;
mod progress;
mod prompt;
mod pull;
mod push;
mod redact;
mod remotes;

pub use fetch::{FetchOptions, FetchSummary, FetchTarget, fetch_command, summarize_fetch};
pub use progress::{Progress, parse_progress};
pub use prompt::{PromptKind, classify_prompt};
pub use pull::{PullMode, describe_pull, pull_command, pull_hint};
pub use push::{
    Lease, PushOptions, PushSummary, PushWhat, describe_push, push_command, push_hint,
    summarize_push,
};
pub use redact::redact_credentials;
pub use remotes::remote_names;
