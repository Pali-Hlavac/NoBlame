//! Side-by-side rows of a file diff, for the diff tab.

use git_core::diff::{SplitCell, SplitLine};
use serde::Serialize;
use specta::Type;

use super::diff::DiffLineKindDto;
use super::syntax::{SyntaxClassDto, syntax_spans};

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
    /// Syntax colours: `[start, end, class]` in UTF-16 code units.
    pub syntax: Vec<(u32, u32, SyntaxClassDto)>,
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
            syntax: syntax_spans(cell.syntax),
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
