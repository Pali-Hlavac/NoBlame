//! The working tree of an open repository: its status (staged, changed, untracked and
//! conflicted files), its files as git would store them, staging (whole files or lines),
//! discarding, and committing (with what the message box offers).

pub mod commands;
mod message;
mod partial;
mod service;
mod staging;
mod types;

pub use types::WorkingTreeStatusDto;
