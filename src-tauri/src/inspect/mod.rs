//! Read-only views of an open repository for the workbench modules: commit details (with the
//! refs containing the commit), the list of references and the stash list. See `docs/design/workbench.md`.

pub mod commands;
mod service;
mod types;

pub use types::{CommitDetailsDto, RefEntry, StashDto};
