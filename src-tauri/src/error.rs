//! Application-wide error model that crosses the IPC boundary (ADR 0006).
//!
//! Every module defines its own `thiserror` enum and converts it into [`AppError`] via
//! `From`. Only [`AppError`] is ever serialized to the frontend.

use serde::Serialize;
use specta::Type;

/// Stable, machine-readable error category the frontend can branch on.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ErrorCode {
    /// An unexpected failure inside the app; usually a bug.
    Internal,
    /// Reading or writing a local file failed.
    Io,
    /// Data on disk could not be parsed.
    InvalidData,
    /// The input from the user or the command line is incomplete or contradictory.
    InvalidInput,
    /// The requested item does not exist.
    NotFound,
    /// No `git` executable was found.
    GitNotFound,
    /// A `git` executable was found but cannot be used (broken install, too old, ...).
    GitUnusable,
    /// A git command failed; the message carries git's own explanation.
    GitFailed,
    /// The user cancelled the operation.
    Cancelled,
}

/// Serializable error returned by every fallible Tauri command.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct AppError {
    /// Category used by the UI to pick an icon, retry policy, etc.
    pub code: ErrorCode,
    /// What happened, phrased for an end user.
    pub message: String,
    /// What the user can do next, if there is anything useful to suggest.
    pub hint: Option<String>,
}

impl AppError {
    /// Creates an error without a hint.
    pub fn new(code: ErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
            hint: None,
        }
    }

    /// Attaches a "what to do next" hint to the error.
    #[must_use]
    pub fn with_hint(mut self, hint: impl Into<String>) -> Self {
        self.hint = Some(hint.into());
        self
    }
}

impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{:?}: {}", self.code, self.message)
    }
}

impl std::error::Error for AppError {}

impl From<tauri::Error> for AppError {
    fn from(error: tauri::Error) -> Self {
        tracing::error!(%error, "tauri runtime error");
        AppError::new(
            ErrorCode::Internal,
            format!("The window system failed: {error}"),
        )
    }
}

/// Result alias used by Tauri command handlers.
pub type CommandResult<T> = Result<T, AppError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serializes_with_camel_case_and_screaming_code() {
        let error = AppError::new(ErrorCode::GitNotFound, "no git").with_hint("install it");
        let json = serde_json::to_value(&error).unwrap();
        assert_eq!(
            json,
            serde_json::json!({ "code": "GIT_NOT_FOUND", "message": "no git", "hint": "install it" })
        );
    }

    #[test]
    fn hint_is_null_when_absent() {
        let json = serde_json::to_value(AppError::new(ErrorCode::Io, "x")).unwrap();
        assert!(json["hint"].is_null());
    }
}
