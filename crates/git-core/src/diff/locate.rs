//! The row that shows a given line, so a view keeps its place when the same file is compared
//! again with other options (more context, another whitespace mode, the other layout).

use super::file::FileDiff;
use super::rows::Row;
use super::split::SplitRow;
use super::text::to_u32;

/// A version of the file.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LineSide {
    /// Before the change.
    Old,
    /// After the change.
    New,
}

/// The index of the row whose line is closest to `target` (the first one on a tie).
fn nearest(lines: impl Iterator<Item = Option<u32>>, target: u32) -> Option<u32> {
    let mut best: Option<(u32, usize)> = None;
    for (index, line) in lines.enumerate() {
        let Some(line) = line else { continue };
        let distance = line.abs_diff(target);
        if best.is_none_or(|(closest, _)| distance < closest) {
            best = Some((distance, index));
            if distance == 0 {
                break;
            }
        }
    }
    best.map(|(_, index)| to_u32(index))
}

impl FileDiff {
    /// The unified row showing line `line` (1-based) of `side`, or the row of the nearest line
    /// shown when the context hides it; `None` without rows.
    pub fn row_of_line(&self, side: LineSide, line: u32) -> Option<u32> {
        let target = line.saturating_sub(1);
        let lines = self.rows.iter().map(|row| match (*row, side) {
            (Row::Context { old, .. } | Row::Removed { old }, LineSide::Old) => Some(old),
            (Row::Context { new, .. } | Row::Added { new }, LineSide::New) => Some(new),
            _ => None,
        });
        nearest(lines, target)
    }

    /// The side-by-side row showing line `line` (1-based) of `side`, or the row of the nearest
    /// line shown; `None` without rows.
    pub fn split_row_of_line(&self, side: LineSide, line: u32) -> Option<u32> {
        let target = line.saturating_sub(1);
        let lines = self.split.iter().map(|row| match (*row, side) {
            (SplitRow::Lines { left, .. }, LineSide::Old) => left.map(|half| half.line),
            (SplitRow::Lines { right, .. }, LineSide::New) => right.map(|half| half.line),
            (SplitRow::Hunk { .. }, _) => None,
        });
        nearest(lines, target)
    }
}

#[cfg(test)]
mod tests {
    use gix::diff::blob::Algorithm;

    use super::LineSide;
    use crate::diff::file::diff_blobs;
    use crate::diff::{DiffOptions, WHOLE_FILE_CONTEXT};

    fn numbered(lines: std::ops::Range<u32>) -> String {
        use std::fmt::Write;
        lines.fold(String::new(), |mut text, line| {
            let _ = writeln!(text, "line {line}");
            text
        })
    }

    fn diff(context: u32) -> crate::diff::FileDiff {
        // Line 10 of 30 changes, and a line is added after line 25.
        let old = numbered(1..31);
        let new = old
            .replace("line 10\n", "line ten\n")
            .replace("line 25\n", "line 25\nnew\n");
        let options = DiffOptions {
            context,
            ..DiffOptions::default()
        };
        diff_blobs(old.into(), new.into(), Algorithm::Myers, options)
    }

    #[test]
    fn finds_the_row_of_a_line_in_both_layouts() {
        let whole = diff(WHOLE_FILE_CONTEXT);
        // Unified: line 1 is row 1 (after the hunk header); old line 10 is removed on row 10.
        assert_eq!(whole.row_of_line(LineSide::New, 1), Some(1));
        assert_eq!(whole.row_of_line(LineSide::Old, 10), Some(10));
        assert_eq!(whole.row_of_line(LineSide::New, 10), Some(11));
        // Side by side, the removed and the added line share row 10.
        assert_eq!(whole.split_row_of_line(LineSide::Old, 10), Some(10));
        assert_eq!(whole.split_row_of_line(LineSide::New, 10), Some(10));
        let row = whole.row_of_line(LineSide::New, 20).unwrap_or_default();
        let line = whole.lines(row, 1).first().and_then(|line| line.new_line);
        assert_eq!(line, Some(20));
    }

    #[test]
    fn falls_back_to_the_nearest_line_shown() {
        let narrow = diff(3);
        // Line 17 is hidden between the hunks; line 13 (last of the first hunk) is closest.
        let row = narrow.row_of_line(LineSide::New, 17).unwrap_or_default();
        let line = narrow.lines(row, 1).first().and_then(|line| line.new_line);
        assert_eq!(line, Some(13));
        assert_eq!(diff(0).row_of_line(LineSide::Old, 1), Some(1));
    }
}
