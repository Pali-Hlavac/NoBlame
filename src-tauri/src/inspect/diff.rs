//! The line diff of one file, for the diff tab: a summary, then rows page by page.

use git_core::diff::{DiffContent, DiffLine, FileDiff, LineKind};
use serde::Serialize;
use specta::Type;

/// How a file was compared.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum DiffContentDto {
    /// Line by line.
    Text,
    /// Binary contents: only the sizes.
    Binary,
    /// Larger than 64 MiB: only the sizes.
    TooLarge,
}

/// What the diff tab needs before it asks for rows.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct FileDiffDto {
    /// How the file was compared.
    pub content: DiffContentDto,
    /// Rows of the unified diff, hunk headers included (fetch them with `get_diff_lines`).
    pub rows: u32,
    /// Added lines.
    pub additions: u32,
    /// Removed lines.
    pub deletions: u32,
    /// Number of hunks.
    pub hunks: u32,
    /// Lines of the old version (0 unless compared as text).
    pub old_lines: u32,
    /// Lines of the new version (0 unless compared as text).
    pub new_lines: u32,
    /// Size of the old version in bytes, as a decimal string (0 when absent).
    pub old_size: String,
    /// Size of the new version in bytes, as a decimal string (0 when absent).
    pub new_size: String,
}

impl From<&FileDiff> for FileDiffDto {
    fn from(diff: &FileDiff) -> Self {
        Self {
            content: match diff.content() {
                DiffContent::Text => DiffContentDto::Text,
                DiffContent::Binary => DiffContentDto::Binary,
                DiffContent::TooLarge => DiffContentDto::TooLarge,
            },
            rows: diff.row_count(),
            additions: diff.additions(),
            deletions: diff.deletions(),
            hunks: diff.hunk_count(),
            old_lines: diff.old_lines(),
            new_lines: diff.new_lines(),
            old_size: diff.old_size().to_string(),
            new_size: diff.new_size().to_string(),
        }
    }
}

/// What a row shows.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum DiffLineKindDto {
    /// `@@ -1,3 +1,4 @@` (in `text`).
    Hunk,
    /// Unchanged line.
    Context,
    /// Added line.
    Added,
    /// Removed line.
    Removed,
    /// "No newline at end of file" for the row above (empty `text`).
    NoNewline,
}

/// One row of the unified diff.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct DiffLineDto {
    /// What the row shows.
    pub kind: DiffLineKindDto,
    /// 1-based line number in the old version.
    pub old_line: Option<u32>,
    /// 1-based line number in the new version.
    pub new_line: Option<u32>,
    /// The line without its line ending (non-UTF-8 bytes replaced).
    pub text: String,
    /// The line was cut at 4,096 bytes.
    pub truncated: bool,
}

impl From<DiffLine> for DiffLineDto {
    fn from(line: DiffLine) -> Self {
        Self {
            kind: match line.kind {
                LineKind::Hunk => DiffLineKindDto::Hunk,
                LineKind::Context => DiffLineKindDto::Context,
                LineKind::Added => DiffLineKindDto::Added,
                LineKind::Removed => DiffLineKindDto::Removed,
                LineKind::NoNewline => DiffLineKindDto::NoNewline,
            },
            old_line: line.old_line,
            new_line: line.new_line,
            text: line.text,
            truncated: line.truncated,
        }
    }
}
