//! NoBlame's Git engine.
//!
//! This crate never depends on Tauri, so everything here is testable with plain `cargo test`.
//! Reads (history, refs, trees, diffs, blame, status) will use `gix`; every write and every
//! network operation goes through the user's installed `git` via [`cli::GitCommand`].
//! See `docs/architecture/git-engine.md`.

pub mod cli;
pub mod graph;
pub mod repo;
pub mod stash;
pub mod submodule;
