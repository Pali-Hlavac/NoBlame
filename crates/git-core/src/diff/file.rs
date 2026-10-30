//! The line diff of one file: two blobs compared in memory with imara-diff (through gix, with
//! git's slider heuristics and the repository's `diff.algorithm`). The result keeps both blobs
//! and compact rows, so a huge diff is rendered page by page (`unified.rs`, `split.rs`).

use gix::diff::blob::{Algorithm, diff_with_slider_heuristics};

use super::attributes::DiffAttribute;
use super::lines::DiffContent;
use super::options::{DiffOptions, Whitespace, intern};
use super::rows::{Row, Sides, build_rows};
use super::split::{SplitRow, build_split};
use super::syntax::Highlighter;
use super::text::{Side, is_binary, to_u32};

/// The diff of two versions of a file.
#[derive(Debug)]
pub struct FileDiff {
    content: DiffContent,
    pub(super) old: Side,
    pub(super) new: Side,
    pub(super) rows: Vec<Row>,
    /// The same rows side by side.
    pub(super) split: Vec<SplitRow>,
    /// For each removed or added row, the unified row it is paired with (for word changes);
    /// `u32::MAX` for none.
    pub(super) partners: Vec<u32>,
    /// Which whitespace counts, also when comparing words.
    pub(super) whitespace: Whitespace,
    /// Syntax highlighting of each side (see `highlight.rs`); `None` when off or unknown.
    pub(super) old_syntax: Option<Highlighter>,
    pub(super) new_syntax: Option<Highlighter>,
    additions: u32,
    deletions: u32,
    old_size: u64,
    new_size: u64,
}

/// The diff of two file contents.
pub(crate) fn diff_blobs(
    old: Vec<u8>,
    new: Vec<u8>,
    algorithm: Algorithm,
    options: DiffOptions,
) -> FileDiff {
    let (old_size, new_size) = (old.len() as u64, new.len() as u64);
    let binary = match options.attribute {
        DiffAttribute::Binary => true,
        DiffAttribute::Text => false,
        DiffAttribute::Unspecified => is_binary(&old) || is_binary(&new),
    };
    if binary {
        return FileDiff::sizes_only(DiffContent::Binary, old_size, new_size);
    }
    let (old, new) = (Side::new(old), Side::new(new));
    let input = intern(&old, &new, options.whitespace);
    let diff = diff_with_slider_heuristics(algorithm, &input);
    drop(input);
    let changes: Vec<_> = diff.hunks().map(|hunk| (hunk.before, hunk.after)).collect();
    let sides = Sides {
        old_lines: old.line_count(),
        new_lines: new.line_count(),
        old_open: old.open(),
        new_open: new.open(),
    };
    let rows = build_rows(&changes, sides, options.context);
    let (split, partners) = build_split(&rows);
    FileDiff {
        content: DiffContent::Text,
        split,
        partners,
        whitespace: options.whitespace,
        old_syntax: None,
        new_syntax: None,
        rows,
        additions: diff.count_additions(),
        deletions: diff.count_removals(),
        old,
        new,
        old_size,
        new_size,
    }
}

/// One version of a file shown whole, for viewing it at a revision: every line is an unchanged
/// row and there is no hunk header. Rows read their text from the new side; the old side and
/// the side-by-side rows stay empty (a file view is always one column).
pub(crate) fn whole_blob(data: Vec<u8>, attribute: DiffAttribute) -> FileDiff {
    let size = data.len() as u64;
    let binary = match attribute {
        DiffAttribute::Binary => true,
        DiffAttribute::Text => false,
        DiffAttribute::Unspecified => is_binary(&data),
    };
    if binary {
        return FileDiff::sizes_only(DiffContent::Binary, size, size);
    }
    let new = Side::new(data);
    let lines = new.line_count();
    let mut rows: Vec<Row> = (0..lines)
        .map(|line| Row::Context {
            old: line,
            new: line,
        })
        .collect();
    if new.open() {
        rows.push(Row::NoNewline);
    }
    FileDiff {
        content: DiffContent::Text,
        old: Side::default(),
        new,
        rows,
        split: Vec::new(),
        partners: Vec::new(),
        whitespace: Whitespace::Show,
        old_syntax: None,
        new_syntax: None,
        additions: 0,
        deletions: 0,
        old_size: size,
        new_size: size,
    }
}

impl FileDiff {
    pub(super) fn sizes_only(content: DiffContent, old_size: u64, new_size: u64) -> Self {
        Self {
            content,
            old: Side::default(),
            new: Side::default(),
            rows: Vec::new(),
            split: Vec::new(),
            partners: Vec::new(),
            whitespace: Whitespace::Show,
            old_syntax: None,
            new_syntax: None,
            additions: 0,
            deletions: 0,
            old_size,
            new_size,
        }
    }

    /// How the file was compared.
    pub fn content(&self) -> DiffContent {
        self.content
    }

    /// Rows of the unified diff (hunk headers included); 0 when nothing changed in the text.
    pub fn row_count(&self) -> u32 {
        to_u32(self.rows.len())
    }

    /// Added lines.
    pub fn additions(&self) -> u32 {
        self.additions
    }

    /// Removed lines.
    pub fn deletions(&self) -> u32 {
        self.deletions
    }

    /// Number of hunks.
    pub fn hunk_count(&self) -> u32 {
        to_u32(
            self.rows
                .iter()
                .filter(|row| matches!(row, Row::Hunk { .. }))
                .count(),
        )
    }

    /// Lines of the old version (0 unless compared as text).
    pub fn old_lines(&self) -> u32 {
        self.old.line_count()
    }

    /// Lines of the new version (0 unless compared as text).
    pub fn new_lines(&self) -> u32 {
        self.new.line_count()
    }

    /// Size of the old version in bytes (0 when absent).
    pub fn old_size(&self) -> u64 {
        self.old_size
    }

    /// Size of the new version in bytes (0 when absent).
    pub fn new_size(&self) -> u64 {
        self.new_size
    }

    /// Bytes held, for cache budgets.
    pub fn memory_bytes(&self) -> usize {
        let side = |side: &Side| side.data.capacity() + side.starts.capacity() * size_of::<usize>();
        side(&self.old)
            + side(&self.new)
            + self.rows.capacity() * size_of::<Row>()
            + self.split.capacity() * size_of::<SplitRow>()
            + self.partners.capacity() * size_of::<u32>()
    }
}
