//! Update errors and their mapping to [`AppError`].

use crate::error::{AppError, ErrorCode};

/// Failures while checking for or installing an update.
#[derive(Debug, thiserror::Error)]
pub enum UpdateError {
    /// The build has no update key or feed (built from source).
    #[error("this build does not update itself")]
    NotConfigured,
    /// Installing was asked for without a checked update.
    #[error("no update was found to install")]
    NothingToInstall,
    /// The feed, the download or the signature failed.
    #[error(transparent)]
    Updater(#[from] tauri_plugin_updater::Error),
}

impl From<UpdateError> for AppError {
    fn from(error: UpdateError) -> Self {
        match error {
            UpdateError::NotConfigured => AppError::new(
                ErrorCode::InvalidInput,
                "This build of NoBlame does not update itself.",
            )
            .with_hint(
                "Builds from source are updated by building them again; installed releases update.",
            ),
            UpdateError::NothingToInstall => AppError::new(
                ErrorCode::InvalidInput,
                "There is no update to install. Check for updates first.",
            ),
            UpdateError::Updater(error) => {
                tracing::warn!(%error, "update failed");
                updater_error(&error)
            }
        }
    }
}

/// What a failed check or install tells the user: a bad signature is not a network problem.
fn updater_error(error: &tauri_plugin_updater::Error) -> AppError {
    use tauri_plugin_updater::Error as Updater;
    match error {
        Updater::Minisign(_)
        | Updater::Base64(_)
        | Updater::SignatureUtf8(_)
        | Updater::SignedVersionMismatch { .. }
        | Updater::MissingSignedVersion => AppError::new(
            ErrorCode::InvalidData,
            "The update is not signed with NoBlame's key, so it was not installed.",
        )
        .with_hint("Your NoBlame is unchanged. Get the new version from NoBlame's release page."),
        Updater::Reqwest(_) | Updater::Network(_) | Updater::ReleaseNotFound => AppError::new(
            ErrorCode::Io,
            format!("Could not reach NoBlame's releases: {error}"),
        )
        .with_hint("Check the internet connection and try again later."),
        _ => AppError::new(ErrorCode::Io, format!("Updating failed: {error}"))
            .with_hint("Your NoBlame is unchanged. Try again later."),
    }
}
