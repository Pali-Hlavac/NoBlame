//! Branches and tags of an open repository: checking out a branch or a commit, creating,
//! renaming and deleting branches, creating and deleting tags; upstreams and ahead/behind;
//! managing remotes. See `docs/features/branches.md` and `docs/features/remotes.md`.

pub mod commands;
mod follow;
pub mod remote_commands;
mod remote_password;
mod remote_settings;
mod remote_settings_types;
mod remote_ssh;
mod remote_types;
pub mod remote_web;
mod remotes;
mod service;
mod types;
mod upstream;

pub use types::UniqueCommitsDto;
