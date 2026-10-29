//! What a rendered file diff looks like: unified rows and side-by-side rows.

/// What kind of comparison a file got.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DiffContent {
    /// Compared line by line.
    Text,
    /// One side is binary (a NUL byte, as git decides); only the sizes are known.
    Binary,
    /// One side is larger than [`MAX_DIFF_BLOB_BYTES`](super::MAX_DIFF_BLOB_BYTES); only the
    /// sizes are known.
    TooLarge,
}

/// What a row (or one side of a side-by-side row) shows.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LineKind {
    /// Hunk header; the text is `@@ -1,3 +1,4 @@`.
    Hunk,
    /// Unchanged line.
    Context,
    /// Line only in the new version.
    Added,
    /// Line only in the old version.
    Removed,
    /// The line above has no newline at the end of the file (no text). Unified rows only.
    NoNewline,
}

/// One unified row.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DiffLine {
    /// What the row shows.
    pub kind: LineKind,
    /// 1-based line number in the old version (context and removed lines).
    pub old_line: Option<u32>,
    /// 1-based line number in the new version (context and added lines).
    pub new_line: Option<u32>,
    /// The line without its line ending; lossy for non-UTF-8 bytes.
    pub text: String,
    /// The line was longer than [`MAX_LINE_BYTES`](super::MAX_LINE_BYTES) and was cut.
    pub truncated: bool,
}

/// One side of a side-by-side row.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SplitCell {
    /// [`LineKind::Context`], [`LineKind::Removed`] (left) or [`LineKind::Added`] (right).
    pub kind: LineKind,
    /// 1-based line number on this side.
    pub line: u32,
    /// The line without its line ending; lossy for non-UTF-8 bytes.
    pub text: String,
    /// The line was cut at [`MAX_LINE_BYTES`](super::MAX_LINE_BYTES).
    pub truncated: bool,
    /// The last line of this side, without a newline at the end.
    pub no_newline: bool,
}

/// One side-by-side row: a hunk header, or a line on the left, the right or both.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SplitLine {
    /// The hunk header (`@@ -1,3 +1,4 @@`); the cells are then empty.
    pub hunk: Option<String>,
    /// Old version: context or a removed line.
    pub left: Option<SplitCell>,
    /// New version: context or an added line.
    pub right: Option<SplitCell>,
}
