//! The working tree of an open repository: its status (staged, changed, untracked and
//! conflicted files), its files as git would store them, staging and committing.

pub mod commands;
mod service;
mod staging;
mod types;

pub use types::WorkingTreeStatusDto;
