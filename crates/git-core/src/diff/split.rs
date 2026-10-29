//! Side-by-side rows, built from the unified rows: unchanged lines on both sides, and each run
//! of removed lines paired line by line with the run of added lines after it. "No newline at
//! end of file" becomes a flag on the cell instead of a row of its own.

use super::file::FileDiff;
use super::lines::{LineKind, SplitCell, SplitLine};
use super::rows::Row;
use super::text::{display_text, hunk_range, to_u32};

/// One side of a side-by-side row: a 0-based line on that side.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) struct Half {
    line: u32,
    kind: LineKind,
    no_newline: bool,
}

impl Half {
    fn new(line: u32, kind: LineKind) -> Self {
        Self {
            line,
            kind,
            no_newline: false,
        }
    }
}

/// One side-by-side row.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum SplitRow {
    /// The hunk header at this unified row.
    Hunk { row: u32 },
    /// A line on the left, the right or both.
    Lines {
        left: Option<Half>,
        right: Option<Half>,
    },
}

/// The side-by-side rows for `rows`.
pub(super) fn build_split(rows: &[Row]) -> Vec<SplitRow> {
    let mut split = Vec::with_capacity(rows.len());
    let (mut removed, mut added) = (Vec::new(), Vec::new());
    for (index, row) in rows.iter().enumerate() {
        match *row {
            Row::Hunk { .. } => {
                pair(&mut split, &mut removed, &mut added);
                split.push(SplitRow::Hunk { row: to_u32(index) });
            }
            Row::Context { old, new } => {
                pair(&mut split, &mut removed, &mut added);
                split.push(SplitRow::Lines {
                    left: Some(Half::new(old, LineKind::Context)),
                    right: Some(Half::new(new, LineKind::Context)),
                });
            }
            Row::Removed { old } => {
                if !added.is_empty() {
                    pair(&mut split, &mut removed, &mut added);
                }
                removed.push(Half::new(old, LineKind::Removed));
            }
            Row::Added { new } => added.push(Half::new(new, LineKind::Added)),
            Row::NoNewline => mark_no_newline(&mut split, &mut removed, &mut added, rows, index),
        }
    }
    pair(&mut split, &mut removed, &mut added);
    split
}

/// Emits the pending removed and added runs side by side.
fn pair(split: &mut Vec<SplitRow>, removed: &mut Vec<Half>, added: &mut Vec<Half>) {
    for index in 0..removed.len().max(added.len()) {
        split.push(SplitRow::Lines {
            left: removed.get(index).copied(),
            right: added.get(index).copied(),
        });
    }
    removed.clear();
    added.clear();
}

/// Flags the cell of the row before the "No newline" row at `index`.
fn mark_no_newline(
    split: &mut [SplitRow],
    removed: &mut [Half],
    added: &mut [Half],
    rows: &[Row],
    index: usize,
) {
    let flag = |half: Option<&mut Half>| {
        if let Some(half) = half {
            half.no_newline = true;
        }
    };
    match index.checked_sub(1).and_then(|before| rows.get(before)) {
        Some(Row::Removed { .. }) => flag(removed.last_mut()),
        Some(Row::Added { .. }) => flag(added.last_mut()),
        Some(Row::Context { .. }) => {
            if let Some(SplitRow::Lines { left, right }) = split.last_mut() {
                flag(left.as_mut());
                flag(right.as_mut());
            }
        }
        _ => {}
    }
}

impl FileDiff {
    /// Rows of the side-by-side view (hunk headers included).
    pub fn split_row_count(&self) -> u32 {
        to_u32(self.split.len())
    }

    /// Up to `count` side-by-side rows from row `start`.
    pub fn split_lines(&self, start: u32, count: u32) -> Vec<SplitLine> {
        let start = (start as usize).min(self.split.len());
        let end = start.saturating_add(count as usize).min(self.split.len());
        self.split[start..end]
            .iter()
            .map(|row| self.render_split(*row))
            .collect()
    }

    fn render_split(&self, row: SplitRow) -> SplitLine {
        match row {
            SplitRow::Hunk { row } => {
                let hunk = match self.rows.get(row as usize) {
                    Some(&Row::Hunk {
                        old_start,
                        old_len,
                        new_start,
                        new_len,
                    }) => format!(
                        "@@ -{} +{} @@",
                        hunk_range(old_start, old_len),
                        hunk_range(new_start, new_len)
                    ),
                    _ => String::new(),
                };
                SplitLine {
                    hunk: Some(hunk),
                    left: None,
                    right: None,
                }
            }
            SplitRow::Lines { left, right } => SplitLine {
                hunk: None,
                left: left.map(|half| self.cell(half, true)),
                right: right.map(|half| self.cell(half, false)),
            },
        }
    }

    /// Context shows each side's own text: with whitespace ignored, the two may differ.
    fn cell(&self, half: Half, old_side: bool) -> SplitCell {
        let side = if old_side { &self.old } else { &self.new };
        let (text, truncated) = display_text(side.line(half.line));
        SplitCell {
            kind: half.kind,
            line: half.line + 1,
            text,
            truncated,
            no_newline: half.no_newline,
        }
    }
}
