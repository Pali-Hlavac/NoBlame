//! Diff tab preferences: layout, whitespace, context, colours, and the external diff tool.

use serde::{Deserialize, Serialize};
use specta::Type;

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
    /// The program "Open in diff tool" starts.
    pub external_tool: ExternalDiffTool,
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
            external_tool: ExternalDiffTool::default(),
        }
    }
}

/// Which program shows a diff outside the app. Each runs through `git difftool --no-index`, so
/// git starts it as it would from a terminal.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum ExternalDiffToolKind {
    /// The user's `diff.tool` (or `merge.tool`) from their git config.
    #[default]
    Git,
    /// Visual Studio Code (`code --wait --diff`).
    VsCode,
    /// The command in [`ExternalDiffTool::command`].
    Custom,
}

/// The external diff tool.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase", default)]
pub struct ExternalDiffTool {
    /// Which program.
    pub kind: ExternalDiffToolKind,
    /// For [`ExternalDiffToolKind::Custom`]: a shell command git runs with the old and the new
    /// file appended (`git difftool --extcmd`); it must wait until the tool is closed.
    pub command: String,
}
