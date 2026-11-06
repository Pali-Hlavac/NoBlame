//! Credentials for background jobs (ADR 0012). git's credential helpers (Git Credential
//! Manager, the macOS keychain, `store`) and ssh agents answer first, as configured. When they
//! cannot, git and ssh run their askpass program: for job commands that is `noblame` itself
//! (`client.rs`), which hands the prompt to the running app (`server.rs`) over localhost with
//! a per-run token. The app shows a dialog and passes the answer back; it never stores it.

mod client;
pub mod commands;
mod protocol;
mod server;
mod token;
mod types;

pub use client::run_if_helper;
pub use server::Askpass;
pub use types::{CredentialClosed, CredentialRequested};
