//! Talking to remotes: fetch (`fetch.rs`), pull (`pull.rs`), push (`push.rs`), clone
//! (`clone.rs`), the remote names and where the current branch pushes (`remotes.rs`), adding,
//! renaming and removing remotes (`manage.rs`), reading git's progress lines (`progress.rs`) and
//! what an askpass prompt asks for (`prompt.rs`), hiding credentials in URLs (`redact.rs`),
//! saving the remote editor's changes all or nothing (`settings.rs`).
//! These commands run as background jobs: the caller streams the command
//! ([`GitCommand::stream`](crate::cli::GitCommand::stream)), feeds each line to
//! [`parse_progress`] and keeps the rest as the job's log.

mod clone;
mod fetch;
mod manage;
mod progress;
mod prompt;
mod pull;
mod push;
mod redact;
mod remotes;
mod settings;
mod validate;

pub use clone::{
    CloneError, CloneFilter, CloneOptions, CloneTarget, check_clone_target, clone_command,
    clone_hint, remove_partial_clone,
};
pub use fetch::{
    FetchOptions, FetchSummary, FetchTarget, fetch_all_remotes, fetch_command, fetch_commands,
    summarize_fetch,
};
pub use manage::{
    RemoteInfo, UrlKind, add_remote, remote_details, remove_remote, rename_remote, set_remote_url,
    unset_push_url,
};
pub use progress::{Progress, parse_progress};
pub use prompt::{PromptKind, classify_prompt};
pub use pull::{PullMode, describe_pull, pull_command, pull_hint};
pub use push::{
    Lease, PushOptions, PushSummary, PushWhat, describe_push, push_command, push_hint,
    summarize_push,
};
pub use redact::redact_credentials;
pub use remotes::{UpstreamPush, remote_names, upstream_push};
pub use settings::{
    HeadChange, RemoteEdit, RemoteEditPlan, apply_remote_edit, describe_remote_edit,
    plan_remote_edit, remote_branch_names, remote_head,
};
pub use validate::{validate_remote_name, validate_url};
