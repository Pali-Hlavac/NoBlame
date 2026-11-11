//! Patches: saving the patches of a commit or a range, checking patch files and applying them
//! (`git_core::patch`). Archives run as background jobs (`crate::jobs`), using the dialogs here.
//! See `docs/features/patches.md`.

pub mod ask;
pub mod commands;
mod error;
mod service;
mod types;

pub use error::{patch_error, patch_hint};
