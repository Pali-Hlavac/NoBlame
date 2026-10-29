//! The line diff of one file, for the diff tab: a summary, then rows page by page, unified or
//! side by side.

use git_core::diff::{
    DiffContent, DiffLine, DiffOptions, FileDiff, LineKind, SplitCell, SplitLine, Whitespace,
};
use serde::{Deserialize, Serialize};
use specta::Type;

use crate::settings::WhitespaceMode;

/// How the diff is computed (the diff tab sends its settings).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct DiffOptionsDto {
    /// Which whitespace changes count.
    pub whitespace: WhitespaceMode,
    /// Unchanged lines around each change; 4294967295 for the whole file.
    pub context: u32,
}

impl From<DiffOptionsDto> for DiffOptions {
    fn from(options: DiffOptionsDto) -> Self {
        Self {
            whitespace: match options.whitespace {
                WhitespaceMode::Show => Whitespace::Show,
                WhitespaceMode::IgnoreAtEol => Whitespace::IgnoreAtEol,
                WhitespaceMode::IgnoreChange => Whitespace::IgnoreChange,
                WhitespaceMode::IgnoreAll => Whitespace::IgnoreAll,
            },
            context: options.context,
        }
    }
}

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
    /// Rows of the side-by-side diff (fetch them with `get_split_diff_lines`).
    pub split_rows: u32,
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
            split_rows: diff.split_row_count(),
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
    /// Changed words of a removed or added line: `[start, end)` in UTF-16 code units.
    pub highlights: Vec<(u32, u32)>,
}

impl From<LineKind> for DiffLineKindDto {
    fn from(kind: LineKind) -> Self {
        match kind {
            LineKind::Hunk => Self::Hunk,
            LineKind::Context => Self::Context,
            LineKind::Added => Self::Added,
            LineKind::Removed => Self::Removed,
            LineKind::NoNewline => Self::NoNewline,
        }
    }
}

impl From<DiffLine> for DiffLineDto {
    fn from(line: DiffLine) -> Self {
        Self {
            kind: line.kind.into(),
            old_line: line.old_line,
            new_line: line.new_line,
            text: line.text,
            truncated: line.truncated,
            highlights: line.highlights,
        }
    }
}

/// One side of a side-by-side row.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct SplitCellDto {
    /// `context`, `removed` (left) or `added` (right).
    pub kind: DiffLineKindDto,
    /// 1-based line number on this side.
    pub line: u32,
    /// The line without its line ending (non-UTF-8 bytes replaced).
    pub text: String,
    /// The line was cut at 4,096 bytes.
    pub truncated: bool,
    /// The last line of this side, without a newline at the end.
    pub no_newline: bool,
    /// Changed words: `[start, end)` in UTF-16 code units.
    pub highlights: Vec<(u32, u32)>,
}

/// One side-by-side row: a hunk header, or a line on the left, the right or both.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct SplitLineDto {
    /// `@@ -1,3 +1,4 @@` for a hunk header (the cells are then `null`).
    pub hunk: Option<String>,
    /// Old version.
    pub left: Option<SplitCellDto>,
    /// New version.
    pub right: Option<SplitCellDto>,
}

impl From<SplitCell> for SplitCellDto {
    fn from(cell: SplitCell) -> Self {
        Self {
            kind: cell.kind.into(),
            line: cell.line,
            text: cell.text,
            truncated: cell.truncated,
            no_newline: cell.no_newline,
            highlights: cell.highlights,
        }
    }
}

impl From<SplitLine> for SplitLineDto {
    fn from(line: SplitLine) -> Self {
        Self {
            hunk: line.hunk,
            left: line.left.map(SplitCellDto::from),
            right: line.right.map(SplitCellDto::from),
        }
    }
}
