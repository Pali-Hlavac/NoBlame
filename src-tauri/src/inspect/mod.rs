//! Read-only views of an open repository for the workbench modules: commit details (with the
//! refs containing the commit), the list of references, the stash list and
//! the submodule tree. See `docs/design/workbench.md`.

pub mod commands;
mod service;
mod status;
mod types;

pub use status::StatusSummaryDto;
pub use types::{CommitDetailsDto, RefEntry, StashDto, SubmoduleDto};
