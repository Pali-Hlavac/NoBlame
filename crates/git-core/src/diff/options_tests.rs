//! Whitespace options, context and side-by-side rows of in-memory contents.

use gix::diff::blob::Algorithm;

use super::file::diff_blobs;
use super::options::comparison_key;
use super::{DiffOptions, FileDiff, LineKind, SplitLine, WHOLE_FILE_CONTEXT, Whitespace};

fn diff_with(old: &str, new: &str, whitespace: Whitespace, context: u32) -> FileDiff {
    let options = DiffOptions {
        whitespace,
        context,
        ..DiffOptions::default()
    };
    diff_blobs(old.into(), new.into(), Algorithm::Myers, options)
}

fn key(line: &str, whitespace: Whitespace) -> String {
    String::from_utf8(comparison_key(line.as_bytes(), whitespace).into_owned()).unwrap_or_default()
}

/// A side-by-side row as text: `left | right`, `-`/`+`/` ` before each line, `$` for no newline.
fn split_text(line: &SplitLine) -> String {
    if let Some(hunk) = &line.hunk {
        return hunk.clone();
    }
    let cell = |cell: &Option<super::SplitCell>| match cell {
        None => String::new(),
        Some(cell) => {
            let marker = match cell.kind {
                LineKind::Removed => '-',
                LineKind::Added => '+',
                _ => ' ',
            };
            let end = if cell.no_newline { "$" } else { "" };
            format!("{marker}{}{}{end}", cell.line, cell.text)
        }
    };
    format!("{} | {}", cell(&line.left), cell(&line.right))
}

#[test]
fn whitespace_keys_follow_git() {
    assert_eq!(key("a  b \t\r\n", Whitespace::IgnoreAtEol), "a  b\n");
    assert_eq!(key("  a \t b  \n", Whitespace::IgnoreChange), " a b\n");
    assert_eq!(key(" a\tb c \n", Whitespace::IgnoreAll), "abc\n");
    assert_eq!(key("a b", Whitespace::IgnoreAll), "ab");
}

#[test]
fn ignored_whitespace_changes_leave_no_rows() {
    let old = "fn main() {\n    run();\n}\n";
    let new = "fn main() {\n\trun();  \n}\n";
    assert!(diff_with(old, new, Whitespace::Show, 3).row_count() > 0);
    assert_eq!(diff_with(old, new, Whitespace::IgnoreAll, 3).row_count(), 0);
    // Trailing spaces alone are ignored at the end of a line; the tab is still a change.
    assert!(diff_with(old, new, Whitespace::IgnoreAtEol, 3).row_count() > 0);
}

#[test]
fn context_can_cover_the_whole_file() {
    let old: String = (0..40)
        .map(|line| format!("{line}\n"))
        .collect::<Vec<_>>()
        .concat();
    let new = old.replace("20\n", "twenty\n");
    assert_eq!(diff_with(&old, &new, Whitespace::Show, 0).row_count(), 3);
    let whole = diff_with(&old, &new, Whitespace::Show, WHOLE_FILE_CONTEXT);
    assert_eq!(whole.row_count(), 1 + 40 + 1);
    assert_eq!(whole.lines(0, 1)[0].text, "@@ -1,40 +1,40 @@");
}

#[test]
fn pairs_removed_and_added_lines_side_by_side() {
    let diff = diff_with("a\nb\nc\nd\n", "a\nB\nx\nd\n", Whitespace::Show, 3);
    let rows: Vec<String> = diff
        .split_lines(0, diff.split_row_count())
        .iter()
        .map(split_text)
        .collect();
    assert_eq!(
        rows,
        [
            "@@ -1,4 +1,4 @@",
            " 1a |  1a",
            "-2b | +2B",
            "-3c | +3x",
            " 4d |  4d"
        ]
    );
}

#[test]
fn uneven_runs_leave_one_side_empty_and_flag_missing_newlines() {
    let diff = diff_with("a\nb", "a\nc\nd", Whitespace::Show, 3);
    let rows: Vec<String> = diff
        .split_lines(0, diff.split_row_count())
        .iter()
        .map(split_text)
        .collect();
    assert_eq!(
        rows,
        ["@@ -1,2 +1,3 @@", " 1a |  1a", "-2b$ | +2c", " | +3d$"]
    );
}

#[test]
fn side_by_side_context_shows_each_sides_text() {
    let diff = diff_with("x\n  a\n", "y\n\ta\n", Whitespace::IgnoreAll, 3);
    let rows = diff.split_lines(0, diff.split_row_count());
    let context = rows
        .last()
        .and_then(|row| row.left.as_ref().zip(row.right.as_ref()));
    let (left, right) = context
        .map(|(l, r)| (l.text.as_str(), r.text.as_str()))
        .unwrap_or_default();
    assert_eq!((left, right), ("  a", "\ta"));
}

#[test]
fn paired_lines_carry_their_changed_words_in_both_views() {
    let diff = diff_with("let a = 1;\n", "let a = 2;\n", Whitespace::Show, 3);
    let unified = diff.lines(0, diff.row_count());
    let highlights: Vec<_> = unified.iter().map(|line| line.highlights.clone()).collect();
    assert_eq!(highlights, [vec![], vec![(8, 9)], vec![(8, 9)]]);
    let split = diff.split_lines(0, diff.split_row_count());
    let pair = split
        .last()
        .and_then(|row| row.left.as_ref().zip(row.right.as_ref()));
    assert_eq!(
        pair.map(|(left, right)| (left.highlights.clone(), right.highlights.clone())),
        Some((vec![(8, 9)], vec![(8, 9)]))
    );
}
