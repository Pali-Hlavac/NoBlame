//! The working tree of an open repository: its status (staged, changed, untracked and
//! conflicted files), its files as git would store them, staging (whole files or lines),
//! discarding and committing.

pub mod commands;
mod partial;
mod service;
mod staging;
mod types;

pub use types::WorkingTreeStatusDto;
