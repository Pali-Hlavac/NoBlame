//! Line diffs of committed files, compared with what `git diff` prints for the same commit.
#![allow(clippy::unwrap_used, clippy::expect_used)]

mod support;

use std::fs;

use git_core::diff::{
    DiffContent, DiffError, DiffOptions, FileDiff, LineKind, WHOLE_FILE_CONTEXT, Whitespace,
    commit_changes, file_diff,
};
use git_core::repo::Repository;
use support::Fixture;

/// The diff of `path` in HEAD against its first parent.
fn head_diff(fixture: &Fixture, path: &str) -> FileDiff {
    head_diff_with(fixture, path, DiffOptions::default())
}

fn head_diff_with(fixture: &Fixture, path: &str, options: DiffOptions) -> FileDiff {
    let repo = Repository::discover(&fixture.path()).unwrap().local();
    let head = repo.head_id().unwrap().detach();
    let changes = commit_changes(&repo, head, 0).unwrap();
    let file = changes
        .files
        .iter()
        .find(|file| file.display_path() == path)
        .unwrap();
    file_diff(&repo, file.old_id, file.new_id, options).unwrap()
}

/// Rows as `git diff` prints them.
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

/// `git diff` of `path` in HEAD, without the file header and without hunk function names.
fn git_diff(fixture: &Fixture, path: &str) -> Vec<String> {
    git_diff_with(fixture, path, &[])
}

fn git_diff_with(fixture: &Fixture, path: &str, options: &[&str]) -> Vec<String> {
    let mut args = vec!["diff", "--no-color"];
    args.extend_from_slice(options);
    args.extend(["HEAD~1", "HEAD", "--", path]);
    let output = fixture.git(&args);
    output
        .lines()
        .skip_while(|line| !line.starts_with("@@"))
        .map(|line| match line.find(" @@") {
            Some(end) if line.starts_with("@@") => line[..end + 3].to_owned(),
            _ => line.to_owned(),
        })
        .collect()
}

fn write(fixture: &Fixture, name: &str, content: &str) {
    fs::write(fixture.path().join(name), content).unwrap();
}

#[test]
fn matches_git_diff_for_an_edited_source_file() {
    let fixture = Fixture::new();
    let before = (1..=60)
        .map(|line| format!("fn item_{line}() {{\n    work({line});\n}}\n\n"))
        .collect::<Vec<_>>()
        .concat();
    write(&fixture, "lib.rs", &before);
    fixture.git(&["add", "."]);
    fixture.commit("base");

    let after = before
        .replace("    work(3);\n", "    work(3);\n    more(3);\n")
        .replace("fn item_20() {\n    work(20);\n}\n\n", "")
        .replace("work(41)", "rework(41)")
        .replace("fn item_60() {\n    work(60);\n}\n\n", "fn item_60() {}");
    write(&fixture, "lib.rs", &after);
    fixture.git(&["add", "."]);
    fixture.commit("edit");

    let diff = head_diff(&fixture, "lib.rs");
    assert_eq!(diff.content(), DiffContent::Text);
    assert_eq!(unified(&diff), git_diff(&fixture, "lib.rs"));
    assert_eq!(diff.hunk_count(), 4);
}

#[test]
fn reads_added_and_binary_files() {
    let fixture = Fixture::new();
    write(&fixture, "keep.txt", "1\n");
    fixture.git(&["add", "."]);
    fixture.commit("base");
    write(&fixture, "new.txt", "one\ntwo");
    fs::write(fixture.path().join("image.bin"), b"\x89PNG\r\n\x1a\n\0\0").unwrap();
    fixture.git(&["add", "."]);
    fixture.commit("add");

    let added = head_diff(&fixture, "new.txt");
    assert_eq!(unified(&added), git_diff(&fixture, "new.txt"));
    let binary = head_diff(&fixture, "image.bin");
    assert_eq!(binary.content(), DiffContent::Binary);
    assert_eq!((binary.old_size(), binary.new_size()), (0, 10));
}

#[test]
fn refuses_objects_that_are_not_files() {
    let fixture = Fixture::new();
    write(&fixture, "a.txt", "a\n");
    fixture.git(&["add", "."]);
    fixture.commit("base");
    let repo = Repository::discover(&fixture.path()).unwrap().local();
    let tree = repo.head_commit().unwrap().tree_id().unwrap().detach();
    assert!(matches!(
        file_diff(&repo, None, Some(tree), DiffOptions::default()),
        Err(DiffError::NotAFile(id)) if id == tree
    ));
}

#[test]
fn whitespace_options_and_context_match_git() {
    let fixture = Fixture::new();
    let before = (1..=30)
        .map(|line| {
            format!(
                "    let value_{line} = {line};
"
            )
        })
        .collect::<Vec<_>>()
        .concat();
    write(&fixture, "ws.rs", &before);
    fixture.git(&["add", "."]);
    fixture.commit("base");
    let after = before
        .replace(
            "    let value_3 = 3;
",
            "	let value_3 = 3;
",
        )
        .replace(
            "value_8 = 8;
",
            "value_8 = 8;   
",
        )
        .replace(
            "    let value_12 = 12;
",
            "    let  value_12 =  12;
",
        )
        .replace("value_25 = 25", "value_25 = 26");
    write(&fixture, "ws.rs", &after);
    fixture.git(&["add", "."]);
    fixture.commit("edit");

    let cases: [(Whitespace, u32, &[&str]); 5] = [
        (Whitespace::IgnoreAtEol, 3, &["--ignore-space-at-eol"]),
        (Whitespace::IgnoreChange, 3, &["-b"]),
        (Whitespace::IgnoreAll, 3, &["-w"]),
        (Whitespace::Show, 0, &["-U0"]),
        (Whitespace::Show, WHOLE_FILE_CONTEXT, &["-U100"]),
    ];
    for (whitespace, context, git_options) in cases {
        let options = DiffOptions {
            whitespace,
            context,
        };
        let diff = head_diff_with(&fixture, "ws.rs", options);
        assert_eq!(
            unified(&diff),
            git_diff_with(&fixture, "ws.rs", git_options),
            "{git_options:?}"
        );
    }
}
