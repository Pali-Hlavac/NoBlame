//! Branches and tags of an open repository: checking out a branch or a commit, creating,
//! renaming and deleting branches, creating and deleting tags; upstreams and ahead/behind. See
//! `docs/features/branches.md`.

pub mod commands;
mod service;
mod types;
mod upstream;
