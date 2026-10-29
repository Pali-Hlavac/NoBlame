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
    /// The diff tab.
    pub diff: DiffSettings,
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

/// How the diff tab lays out a diff.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum DiffLayout {
    /// One column, removed lines above added ones (`git diff`).
    #[default]
    Unified,
    /// Old version on the left, new version on the right.
    Split,
}

/// Which whitespace changes the diff shows, as git's options name them.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Hash, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum WhitespaceMode {
    /// Every change.
    #[default]
    Show,
    /// Not whitespace at the end of lines (`--ignore-space-at-eol`).
    IgnoreAtEol,
    /// Not changes in the amount of whitespace (`-b`).
    IgnoreChange,
    /// No whitespace at all (`-w`).
    IgnoreAll,
}

/// Diff tab preferences.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase", default)]
pub struct DiffSettings {
    /// Unified or side by side.
    pub layout: DiffLayout,
    /// Which whitespace changes are shown.
    pub whitespace: WhitespaceMode,
    /// Unchanged lines around each change; 4294967295 shows the whole file.
    pub context_lines: u32,
}

/// `git diff`'s default context.
const DEFAULT_CONTEXT_LINES: u32 = 3;

impl Default for DiffSettings {
    fn default() -> Self {
        Self {
            layout: DiffLayout::default(),
            whitespace: WhitespaceMode::default(),
            context_lines: DEFAULT_CONTEXT_LINES,
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
        assert_eq!(settings.diff, DiffSettings::default());
        assert_eq!(settings.diff.context_lines, 3);
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
