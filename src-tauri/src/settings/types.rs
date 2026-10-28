//! Settings data model shared with the frontend.

use serde::{Deserialize, Serialize};
use specta::Type;

/// Which color scheme the UI uses.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum ThemePreference {
    /// Follow the operating system setting.
    #[default]
    System,
    /// Always light.
    Light,
    /// Always dark.
    Dark,
}

/// All persisted user preferences. Unknown fields are ignored and missing fields
/// fall back to defaults, so older and newer app versions can share the file.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    /// Color scheme of every window.
    pub theme: ThemePreference,
    /// Commit graph.
    pub graph: GraphSettings,
    /// Repositories module.
    pub repositories: RepositoriesSettings,
}

/// Commit graph preferences.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase", default)]
pub struct GraphSettings {
    /// Selecting a commit highlights its history and the commits by the same author.
    pub highlight_selection: bool,
    /// Where staged and unstaged changes are shown.
    pub working_tree: WorkingTreeDisplay,
}

/// Where the working tree changes (staged, unstaged, untracked, conflicted) are shown.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum WorkingTreeDisplay {
    /// Rows at the top of the commit graph, as Git Extensions does.
    #[default]
    Rows,
    /// A summary in the repository header.
    Header,
    /// Not shown.
    Hidden,
}

impl Default for GraphSettings {
    fn default() -> Self {
        Self {
            highlight_selection: true,
            working_tree: WorkingTreeDisplay::default(),
        }
    }
}

/// Repositories module preferences.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase", default)]
pub struct RepositoriesSettings {
    /// Each repository row has a "…" button with its actions.
    pub show_actions_menu: bool,
}

impl Default for RepositoriesSettings {
    fn default() -> Self {
        Self {
            show_actions_menu: true,
        }
    }
}

#[cfg(test)]
mod tests {
    #![allow(clippy::unwrap_used)]
    use super::*;

    #[test]
    fn older_files_get_the_new_defaults() {
        let settings: Settings = serde_json::from_str(r#"{ "theme": "dark" }"#).unwrap();
        assert_eq!(settings.theme, ThemePreference::Dark);
        assert!(settings.graph.highlight_selection);
        assert_eq!(settings.graph.working_tree, WorkingTreeDisplay::Rows);
        assert!(settings.repositories.show_actions_menu);
    }

    #[test]
    fn a_partial_group_keeps_its_other_defaults() {
        let settings: Settings = serde_json::from_str(
            r#"{ "graph": {}, "repositories": { "showActionsMenu": false } }"#,
        )
        .unwrap();
        assert!(settings.graph.highlight_selection);
        assert!(!settings.repositories.show_actions_menu);
    }
}
