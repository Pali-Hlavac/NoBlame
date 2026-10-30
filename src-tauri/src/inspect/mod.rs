//! Read-only views of an open repository for the workbench modules: commit details (with the
//! refs containing the commit), changed files and their diffs, the files of a revision, the list
//! of references, the stash list and the submodule tree. See `docs/design/workbench.md`.

mod changes;
pub mod commands;
mod diff;
mod files;
mod service;
mod split;
mod status;
mod syntax;
mod types;

pub use changes::ChangedFilesDto;
pub use diff::{DiffLineDto, DiffRequestDto, FileDiffDto, LineSideDto};
pub use files::{FileViewRequestDto, TreeEntryDto, TreeListingDto};
pub use split::SplitLineDto;
pub use status::StatusSummaryDto;
pub use types::{CommitDetailsDto, RefEntry, StashDto, SubmoduleDto};
