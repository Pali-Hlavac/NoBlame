//! The working tree of an open repository: its status (staged, changed, untracked and
//! conflicted files), its files as git would store them, staging (whole files or lines),
//! discarding, committing (with what the message box offers), stashing, ignoring files, and
//! opening a file or showing it in the file manager.

pub mod commands;
mod counts;
mod ignore;
pub mod ignore_commands;
mod message;
pub mod open;
mod partial;
mod service;
mod staging;
mod stash;
pub mod stash_commands;
mod stash_types;
mod types;

pub use counts::ChangeCountsDto;
pub use types::WorkingTreeStatusDto;
