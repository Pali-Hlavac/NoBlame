//! Shared persistence helpers for JSON documents in the app-config directory, and where the
//! app's folders are (`profile`).

mod error;
mod json_file;
pub mod profile;

pub use error::StorageError;
pub use json_file::JsonFile;
