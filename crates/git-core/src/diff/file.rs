//! The line diff of one file: two blobs compared in memory with imara-diff (through gix, with
//! git's slider heuristics and the repository's `diff.algorithm`). The result keeps both blobs
//! and compact rows, so a huge diff is rendered page by page (see [`FileDiff::lines`]).

use gix::diff::blob::{Algorithm, diff_with_slider_heuristics};

use super::lines::{DiffContent, DiffLine, LineKind};
use super::options::{DiffOptions, intern};
use super::rows::{Row, Sides, build_rows};
use super::split::{SplitRow, build_split};
use super::text::{Side, display_text, hunk_range, is_binary, to_u32};

/// The diff of two versions of a file.
#[derive(Debug)]
pub struct FileDiff {
    content: DiffContent,
    pub(super) old: Side,
    pub(super) new: Side,
    pub(super) rows: Vec<Row>,
    /// The same rows side by side.
    pub(super) split: Vec<SplitRow>,
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
    if is_binary(&old) || is_binary(&new) {
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
    FileDiff {
        content: DiffContent::Text,
        split: build_split(&rows),
        rows,
        additions: diff.count_additions(),
        deletions: diff.count_removals(),
        old,
        new,
        old_size,
        new_size,
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
    }

    /// Up to `count` rows from row `start`.
    pub fn lines(&self, start: u32, count: u32) -> Vec<DiffLine> {
        let start = (start as usize).min(self.rows.len());
        let end = start.saturating_add(count as usize).min(self.rows.len());
        self.rows[start..end]
            .iter()
            .map(|row| self.render(*row))
            .collect()
    }

    fn render(&self, row: Row) -> DiffLine {
        let line = |kind, old: Option<u32>, new: Option<u32>, bytes: &[u8]| {
            let (text, truncated) = display_text(bytes);
            DiffLine {
                kind,
                old_line: old.map(|index| index + 1),
                new_line: new.map(|index| index + 1),
                text,
                truncated,
            }
        };
        match row {
            Row::Hunk {
                old_start,
                old_len,
                new_start,
                new_len,
            } => DiffLine {
                kind: LineKind::Hunk,
                old_line: None,
                new_line: None,
                text: format!(
                    "@@ -{} +{} @@",
                    hunk_range(old_start, old_len),
                    hunk_range(new_start, new_len)
                ),
                truncated: false,
            },
            Row::Context { old, new } => {
                line(LineKind::Context, Some(old), Some(new), self.new.line(new))
            }
            Row::Removed { old } => line(LineKind::Removed, Some(old), None, self.old.line(old)),
            Row::Added { new } => line(LineKind::Added, None, Some(new), self.new.line(new)),
            Row::NoNewline => line(LineKind::NoNewline, None, None, &[]),
        }
    }
}
