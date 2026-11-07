//! Branches and tags of an open repository: checking out a branch or a commit, creating,
//! renaming and deleting branches, creating and deleting tags; upstreams and ahead/behind;
//! managing remotes. See `docs/features/branches.md` and `docs/features/remotes.md`.

pub mod commands;
pub mod remote_commands;
mod remote_types;
mod remotes;
mod service;
mod types;
mod upstream;
