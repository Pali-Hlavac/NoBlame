//! The rows of a unified diff: changed ranges with unchanged lines around them, grouped into
//! hunks the way `git diff` groups them.

use std::ops::Range;

/// Unchanged lines shown around each change (`git diff`'s default, `-U3`).
pub const CONTEXT_LINES: u32 = 3;

/// One row of a unified diff. Lines are 0-based indexes into the old or the new side.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum Row {
    /// `@@ -old_start,old_len +new_start,new_len @@`.
    Hunk {
        old_start: u32,
        old_len: u32,
        new_start: u32,
        new_len: u32,
    },
    /// The same line on both sides.
    Context { old: u32, new: u32 },
    /// A line only the old side has.
    Removed { old: u32 },
    /// A line only the new side has.
    Added { new: u32 },
    /// The row before is the last line of its side, and that line has no newline.
    NoNewline,
}

/// What the rows need to know about the two sides.
#[derive(Debug, Clone, Copy)]
pub(super) struct Sides {
    pub old_lines: u32,
    pub new_lines: u32,
    /// The last line of the old side has no newline.
    pub old_open: bool,
    /// The last line of the new side has no newline.
    pub new_open: bool,
}

/// The rows for `changes`: (old lines, new lines) of each changed range, in order, as the
/// diff algorithm reports them. Ranges closer than `2 * context` share one hunk.
pub(super) fn build_rows(
    changes: &[(Range<u32>, Range<u32>)],
    sides: Sides,
    context: u32,
) -> Vec<Row> {
    let mut rows = Vec::new();
    let mut first = 0;
    while first < changes.len() {
        let mut end = first + 1;
        while end < changes.len() && changes[end].0.start - changes[end - 1].0.end <= 2 * context {
            end += 1;
        }
        push_hunk(&mut rows, &changes[first..end], sides, context);
        first = end;
    }
    rows
}

/// One hunk: its header, then context, removed and added lines.
fn push_hunk(rows: &mut Vec<Row>, group: &[(Range<u32>, Range<u32>)], sides: Sides, context: u32) {
    let (Some((first, first_new)), Some((last, last_new))) = (group.first(), group.last()) else {
        return;
    };
    // The unchanged lines between hunks are the same lines on both sides, so the context
    // before and after has the same length on both.
    let lead = first.start.min(context);
    let trail = (sides.old_lines - last.end).min(context);
    let (old_start, new_start) = (first.start - lead, first_new.start - lead);
    let old_end = last.end + trail;
    rows.push(Row::Hunk {
        old_start,
        old_len: old_end - old_start,
        new_start,
        new_len: last_new.end + trail - new_start,
    });
    let (mut old, mut new) = (old_start, new_start);
    for (removed, added) in group {
        push_context(rows, &mut old, &mut new, removed.start, sides);
        for line in removed.clone() {
            rows.push(Row::Removed { old: line });
            if sides.old_open && line + 1 == sides.old_lines {
                rows.push(Row::NoNewline);
            }
        }
        for line in added.clone() {
            rows.push(Row::Added { new: line });
            if sides.new_open && line + 1 == sides.new_lines {
                rows.push(Row::NoNewline);
            }
        }
        (old, new) = (removed.end, added.end);
    }
    push_context(rows, &mut old, &mut new, old_end, sides);
}

/// Unchanged lines from `old`/`new` until the old side reaches `until`.
fn push_context(rows: &mut Vec<Row>, old: &mut u32, new: &mut u32, until: u32, sides: Sides) {
    while *old < until {
        rows.push(Row::Context {
            old: *old,
            new: *new,
        });
        // Equal lines end equally: the old side's last line is the new side's last line.
        if sides.new_open && *new + 1 == sides.new_lines {
            rows.push(Row::NoNewline);
        }
        *old += 1;
        *new += 1;
    }
}
