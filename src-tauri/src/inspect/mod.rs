//! Read-only views of an open repository for the workbench modules: commit details (with the
//! refs containing the commit), changed files and their diffs, two revisions compared, the files of a revision, a file's
//! history and blame, the list of references, the stash list and the submodule tree. See `docs/design/workbench.md`.
//! Commit details also check signatures (`signing`).

mod blame;
mod changes;
pub mod commands;
mod compare;
mod diff;
mod files;
mod history;
mod service;
mod signing;
mod split;
mod status;
mod syntax;
mod types;

pub use blame::BlameDto;
pub use changes::ChangedFilesDto;
pub use compare::{AheadBehindDto, CompareRequestDto, ComparisonDto};
pub use diff::{DiffLineDto, DiffRequestDto, FileDiffDto, LineSideDto};
pub use files::{FileViewRequestDto, TreeEntryDto, TreeListingDto};
pub use history::{FileHistoryDto, FileHistoryRowDto};
pub use signing::{SignatureCheckDto, SignatureFormatDto};
pub use split::SplitLineDto;
pub use status::StatusSummaryDto;
pub use types::{CommitDetailsDto, RefEntry, StashDto, SubmoduleDto};
