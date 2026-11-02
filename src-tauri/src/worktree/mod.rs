//! The working tree of an open repository: its status (staged, changed, untracked and
//! conflicted files) and its files as git would store them. Staging and committing follow in
//! M4 (`docs/roadmap.md`).

pub mod commands;
mod service;
mod types;

pub use types::WorkingTreeStatusDto;
