//! Committing preferences: where the commit window opens.

use serde::{Deserialize, Serialize};
use specta::Type;

/// Committing preferences.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase", default)]
pub struct CommitSettings {
    /// Where the Commit button (and the palette's Commit command) opens the commit window.
    pub open_in: CommitPlacement,
}

/// Where the commit window opens.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum CommitPlacement {
    /// The Commit module in the left dock; the diff tab shows the chosen file.
    #[default]
    Module,
    /// A dialog over the app, with its own diff; the app cannot be used until it closes.
    Dialog,
}
