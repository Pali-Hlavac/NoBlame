//! NoBlame's Git engine.
//!
//! This crate never depends on Tauri, so everything here is testable with plain `cargo test`.
//! Reads (history, refs, trees, diffs, blame, status) will use `gix`; every write and every
//! network operation goes through the user's installed `git` via [`cli::GitCommand`].
//! See `docs/architecture/git-engine.md`.

pub mod blame;
pub mod branch;
pub mod cli;
pub mod commit;
pub mod compare;
pub mod diff;
pub mod difftool;
pub mod graph;
pub mod history;
pub mod ignore;
pub mod remote;
pub mod repo;
pub mod signing;
pub mod stash;
pub mod status;
pub mod submodule;
pub mod tree;
pub mod watch;
