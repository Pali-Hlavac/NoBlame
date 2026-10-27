//! The user's git installation: where it is, which version, whether NoBlame supports it.

pub mod commands;
mod error;
mod service;

pub use error::GitEnvError;
pub use service::{GitInfo, probe};
