//! Settings data model shared with the frontend.

use serde::{Deserialize, Serialize};
use specta::Type;

pub use super::commit::CommitSettings;
pub use super::graph::GraphSettings;

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
    /// Branches module.
    pub branches: BranchesSettings,
    /// Committing.
    pub commit: CommitSettings,
}

/// Branches module preferences.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase", default)]
pub struct BranchesSettings {
    /// Order of the branches and tags in each section.
    pub sort: BranchSort,
}

/// How the Branches module orders the refs of a section.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum BranchSort {
    /// Alphabetically.
    #[default]
    Name,
    /// Newest commit first.
    LastCommit,
}

/// Repositories module preferences.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase", default)]
pub struct RepositoriesSettings {
    /// Each repository row has a "…" button with its actions.
    pub show_actions_menu: bool,
    /// Order of the module's sections, top to bottom (the UI adds any that are missing).
    pub sections: Vec<RepositoriesSection>,
    /// Sections shown folded.
    pub collapsed_sections: Vec<RepositoriesSection>,
}

impl Default for RepositoriesSettings {
    fn default() -> Self {
        Self {
            show_actions_menu: true,
            sections: vec![
                RepositoriesSection::Open,
                RepositoriesSection::Groups,
                RepositoriesSection::Recent,
            ],
            collapsed_sections: Vec::new(),
        }
    }
}

/// A section of the Repositories module.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum RepositoriesSection {
    /// Open repositories with their submodules.
    Open,
    /// The user's repository groups.
    Groups,
    /// Recently opened repositories that are not open.
    Recent,
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
    /// Unchanged lines around each change, unless `whole_file` is set (4294967295, written by
    /// earlier versions, also means the whole file).
    pub context_lines: u32,
    /// Show the whole file instead of the context lines.
    pub whole_file: bool,
    /// Colour the code by its language.
    pub syntax_highlighting: bool,
}

/// `git diff`'s default context.
const DEFAULT_CONTEXT_LINES: u32 = 3;

impl Default for DiffSettings {
    fn default() -> Self {
        Self {
            layout: DiffLayout::default(),
            whitespace: WhitespaceMode::default(),
            context_lines: DEFAULT_CONTEXT_LINES,
            whole_file: false,
            syntax_highlighting: true,
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
        assert_eq!(settings.graph, GraphSettings::default());
        assert!(settings.repositories.show_actions_menu);
        assert_eq!(settings.diff, DiffSettings::default());
        assert_eq!(settings.diff.context_lines, 3);
        assert_eq!(settings.branches.sort, BranchSort::Name);
    }

    #[test]
    fn a_partial_group_keeps_its_other_defaults() {
        let settings: Settings = serde_json::from_str(
            r#"{ "graph": {}, "repositories": { "showActionsMenu": false } }"#,
        )
        .unwrap();
        assert!(settings.graph.highlight_selection);
        assert!(!settings.repositories.show_actions_menu);
        assert_eq!(
            settings.repositories.sections,
            RepositoriesSettings::default().sections
        );
        assert!(settings.repositories.collapsed_sections.is_empty());
    }
}
