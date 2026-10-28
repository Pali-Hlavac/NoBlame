//! Read-only views of an open repository for the workbench modules: commit details (with the
//! refs containing the commit), the list of references, the stash list and
//! the submodule tree. See `docs/design/workbench.md`.

mod changes;
pub mod commands;
mod service;
mod status;
mod types;

pub use changes::ChangedFilesDto;
pub use status::StatusSummaryDto;
pub use types::{CommitDetailsDto, RefEntry, StashDto, SubmoduleDto};
