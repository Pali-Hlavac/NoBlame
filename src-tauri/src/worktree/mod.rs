//! The working tree of an open repository: its status (staged, changed, untracked and
//! conflicted files), its files as git would store them, staging (whole files or lines),
//! discarding, committing (with what the message box offers), and stashing.

pub mod commands;
mod message;
mod partial;
mod service;
mod staging;
mod stash;
pub mod stash_commands;
mod stash_types;
mod types;

pub use types::WorkingTreeStatusDto;
