//! Line diffs of in-memory contents, checked against what `git diff` prints.

use gix::diff::blob::Algorithm;

use super::file::diff_blobs;
use super::{DiffContent, DiffOptions, FileDiff, LineKind, MAX_LINE_BYTES};

fn diff(old: &str, new: &str) -> FileDiff {
    diff_blobs(
        old.into(),
        new.into(),
        Algorithm::Myers,
        DiffOptions::default(),
    )
}

/// Rows as `git diff` prints them, without the file header.
fn unified(diff: &FileDiff) -> Vec<String> {
    diff.lines(0, diff.row_count())
        .into_iter()
        .map(|line| match line.kind {
            LineKind::Hunk => line.text,
            LineKind::Context => format!(" {}", line.text),
            LineKind::Added => format!("+{}", line.text),
            LineKind::Removed => format!("-{}", line.text),
            LineKind::NoNewline => "\\ No newline at end of file".to_owned(),
        })
        .collect()
}

fn numbered(lines: std::ops::Range<u32>) -> String {
    lines
        .map(|line| format!("line {line}\n"))
        .collect::<Vec<_>>()
        .concat()
}

#[test]
fn shows_a_changed_line_with_context() {
    let diff = diff("a\nb\nc\n", "a\nB\nc\n");
    assert_eq!(diff.content(), DiffContent::Text);
    assert_eq!(unified(&diff), ["@@ -1,3 +1,3 @@", " a", "-b", "+B", " c"]);
    assert_eq!(
        (diff.additions(), diff.deletions(), diff.hunk_count()),
        (1, 1, 1)
    );
}

#[test]
fn numbers_lines_from_one_on_each_side() {
    let diff = diff("a\nb\n", "a\nx\nb\n");
    let lines = diff.lines(0, diff.row_count());
    let numbers: Vec<_> = lines
        .iter()
        .map(|line| (line.old_line, line.new_line))
        .collect();
    assert_eq!(
        numbers,
        [
            (None, None),
            (Some(1), Some(1)),
            (None, Some(2)),
            (Some(2), Some(3))
        ]
    );
}

#[test]
fn splits_distant_changes_into_hunks_and_merges_close_ones() {
    let old = numbered(1..21);
    let far = old
        .replace("line 2\n", "two\n")
        .replace("line 18\n", "eighteen\n");
    let diff_far = diff(&old, &far);
    assert_eq!(diff_far.hunk_count(), 2);
    assert_eq!(unified(&diff_far)[0], "@@ -1,5 +1,5 @@");
    assert_eq!(unified(&diff_far)[7], "@@ -15,6 +15,6 @@");

    // Six unchanged lines between the changes: git shows one hunk.
    let close = old
        .replace("line 4\n", "four\n")
        .replace("line 11\n", "eleven\n");
    let diff_close = diff(&old, &close);
    assert_eq!(diff_close.hunk_count(), 1);
    assert_eq!(unified(&diff_close)[0], "@@ -1,14 +1,14 @@");
}

#[test]
fn shows_added_and_deleted_files() {
    let added = diff("", "x\ny\n");
    assert_eq!(unified(&added), ["@@ -0,0 +1,2 @@", "+x", "+y"]);
    let deleted = diff("x\n", "");
    assert_eq!(unified(&deleted), ["@@ -1 +0,0 @@", "-x"]);
}

#[test]
fn marks_a_missing_newline_at_the_end() {
    let diff = diff("a\nb", "a\nc");
    assert_eq!(
        unified(&diff),
        [
            "@@ -1,2 +1,2 @@",
            " a",
            "-b",
            "\\ No newline at end of file",
            "+c",
            "\\ No newline at end of file",
        ]
    );
    let added_newline = diff_blobs(
        "a".into(),
        "a\n".into(),
        Algorithm::Myers,
        DiffOptions::default(),
    );
    assert_eq!(
        unified(&added_newline),
        ["@@ -1 +1 @@", "-a", "\\ No newline at end of file", "+a"]
    );
}

#[test]
fn context_at_the_end_without_newline_is_marked_once() {
    let diff = diff("a\nb", "x\nb");
    assert_eq!(
        unified(&diff),
        [
            "@@ -1,2 +1,2 @@",
            "-a",
            "+x",
            " b",
            "\\ No newline at end of file"
        ]
    );
}

#[test]
fn strips_line_endings_for_display() {
    let diff = diff("a\r\nb\r\n", "a\r\nc\r\n");
    assert_eq!(unified(&diff), ["@@ -1,2 +1,2 @@", " a", "-b", "+c"]);
}

#[test]
fn identical_contents_have_no_rows() {
    let diff = diff("same\n", "same\n");
    assert_eq!(diff.content(), DiffContent::Text);
    assert_eq!(diff.row_count(), 0);
}

#[test]
fn binary_contents_are_not_compared() {
    let diff = diff_blobs(
        b"PNG\0\x01".to_vec(),
        b"PNG\0\x02\x03".to_vec(),
        Algorithm::Myers,
        DiffOptions::default(),
    );
    assert_eq!(diff.content(), DiffContent::Binary);
    assert_eq!(
        (diff.row_count(), diff.old_size(), diff.new_size()),
        (0, 5, 6)
    );
}

#[test]
fn cuts_long_lines_on_a_character_boundary() {
    // "é" is two bytes; a cut at an odd byte would split one.
    let long = format!("a{}\n", "é".repeat(MAX_LINE_BYTES));
    let diff = diff("", &long);
    let line = &diff.lines(1, 1)[0];
    assert!(line.truncated);
    assert!(line.text.len() <= MAX_LINE_BYTES);
    assert!(!line.text.contains('\u{fffd}'));
}

#[test]
fn pages_through_rows() {
    let diff = diff("", &numbered(0..10));
    assert_eq!(diff.row_count(), 11);
    assert_eq!(diff.lines(9, 5).len(), 2);
    assert!(diff.lines(11, 5).is_empty());
    assert!(diff.lines(u32::MAX, u32::MAX).is_empty());
}

#[test]
fn non_utf8_text_is_shown_lossily() {
    let diff = diff_blobs(
        b"caf\xe9\n".to_vec(),
        b"cafe\n".to_vec(),
        Algorithm::Myers,
        DiffOptions::default(),
    );
    assert_eq!(unified(&diff), ["@@ -1 +1 @@", "-caf\u{fffd}", "+cafe"]);
}
