//! Settings data model shared with the frontend.

use serde::{Deserialize, Serialize};
use specta::Type;

pub use super::diff::DiffSettings;
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
    /// Each repository shows how many files are new, changed and deleted but not committed
    /// (closed repositories run `git status` for it, so it is off by default).
    pub show_change_counts: bool,
    /// Quick buttons shown on repository and group rows (on hover or focus); none by default.
    pub buttons: Vec<RepositoryButton>,
    /// Order of the module's sections, top to bottom (the UI adds any that are missing).
    pub sections: Vec<RepositoriesSection>,
    /// Sections shown folded.
    pub collapsed_sections: Vec<RepositoriesSection>,
}

impl Default for RepositoriesSettings {
    fn default() -> Self {
        Self {
            show_actions_menu: true,
            show_change_counts: false,
            buttons: Vec::new(),
            sections: vec![
                RepositoriesSection::Open,
                RepositoriesSection::Groups,
                RepositoriesSection::Recent,
            ],
            collapsed_sections: Vec::new(),
        }
    }
}

/// A quick button on the rows of the Repositories module.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum RepositoryButton {
    /// Pull on each repository.
    Pull,
    /// Push (the current branch to its upstream) on each repository.
    Push,
    /// Pull all on each group.
    PullAll,
    /// Push all on each group.
    PushAll,
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
        assert!(settings.repositories.buttons.is_empty());
    }
}
