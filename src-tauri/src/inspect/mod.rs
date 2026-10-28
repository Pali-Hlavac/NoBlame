//! Read-only views of an open repository for the workbench modules: commit details (with the
//! refs containing the commit) and the list of references. See `docs/design/workbench.md`.

pub mod commands;
mod service;
mod types;

pub use types::{CommitDetailsDto, RefEntry};
