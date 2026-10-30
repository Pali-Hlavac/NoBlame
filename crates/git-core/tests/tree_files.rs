//! The files of a revision: folder listings, entries at a path, saving a file and viewing it
//! whole, checked against what `git` itself reports.
#![allow(clippy::unwrap_used, clippy::expect_used)]

mod support;

use std::fs;

use git_core::diff::{DiffAttribute, DiffContent, LineKind, file_view, parse_object_id};
use git_core::repo::Repository;
use git_core::tree::{TreeEntry, TreeEntryKind, entry_at, list_tree, save_blob};
use support::Fixture;

/// A commit with folders, files, an executable, a symlink and a submodule entry. Symlinks and
/// submodules are added to the index directly, so the test runs on Windows too.
fn fixture() -> Fixture {
    let fixture = Fixture::new();
    let root = fixture.path();
    fs::create_dir_all(root.join("src/app")).unwrap();
    fs::create_dir_all(root.join("Docs")).unwrap();
    fs::write(root.join("b.txt"), "b\n").unwrap();
    fs::write(root.join("A.txt"), "a\n").unwrap();
    fs::write(root.join("run.sh"), "echo hi\n").unwrap();
    fs::write(root.join("src/main.rs"), "fn main() {}\r\n").unwrap();
    fs::write(root.join("src/app/view.rs"), "one\ntwo\nthree").unwrap();
    fs::write(root.join("Docs/guide.md"), "# Guide\n").unwrap();
    fixture.git(&["add", "."]);
    fixture.git(&["update-index", "--chmod=+x", "run.sh"]);
    let target = fixture.git(&["hash-object", "-w", "--stdin"]);
    let link = format!("120000,{target},link");
    fixture.git(&["update-index", "--add", "--cacheinfo", &link]);
    let pointer = format!("160000,{},vendor", "1".repeat(40));
    fixture.git(&["update-index", "--add", "--cacheinfo", &pointer]);
    fixture.commit("files");
    fixture
}

fn open(fixture: &Fixture) -> gix::Repository {
    Repository::discover(&fixture.path()).unwrap().local()
}

fn head(repo: &gix::Repository) -> gix::ObjectId {
    repo.head_id().unwrap().detach()
}

fn id(fixture: &Fixture, revision: &str) -> gix::ObjectId {
    parse_object_id(&fixture.git(&["rev-parse", revision])).unwrap()
}

#[test]
fn lists_folders_first_then_names_ignoring_case() {
    let fixture = fixture();
    let repo = open(&fixture);
    let root = entry_at(&repo, head(&repo), "".into()).unwrap().unwrap();
    assert_eq!(root.kind, TreeEntryKind::Folder);
    assert_eq!(root.id, id(&fixture, "HEAD^{tree}"));

    let listing = list_tree(&repo, root.id).unwrap();
    let names: Vec<(String, TreeEntryKind)> = listing
        .entries
        .iter()
        .map(|entry| (entry.display_name(), entry.kind))
        .collect();
    assert_eq!(
        names,
        [
            ("Docs".to_owned(), TreeEntryKind::Folder),
            ("src".to_owned(), TreeEntryKind::Folder),
            ("A.txt".to_owned(), TreeEntryKind::File),
            ("b.txt".to_owned(), TreeEntryKind::File),
            ("link".to_owned(), TreeEntryKind::Symlink),
            ("run.sh".to_owned(), TreeEntryKind::Executable),
            ("vendor".to_owned(), TreeEntryKind::Submodule),
        ]
    );
    assert_eq!(listing.total, 7);
    let src = &listing.entries[1];
    assert_eq!(src.id, id(&fixture, "HEAD:src"));
    let inner = list_tree(&repo, src.id).unwrap();
    let inner: Vec<String> = inner.entries.iter().map(TreeEntry::display_name).collect();
    assert_eq!(inner, ["app", "main.rs"]);
}

#[test]
fn finds_the_entry_at_a_path() {
    let fixture = fixture();
    let repo = open(&fixture);
    let commit = head(&repo);
    let file = entry_at(&repo, commit, "src/app/view.rs".into())
        .unwrap()
        .unwrap();
    assert_eq!(file.display_name(), "view.rs");
    assert_eq!(file.kind, TreeEntryKind::File);
    assert_eq!(file.id, id(&fixture, "HEAD:src/app/view.rs"));
    let folder = entry_at(&repo, commit, "src/app/".into()).unwrap().unwrap();
    assert_eq!(folder.kind, TreeEntryKind::Folder);
    assert!(
        entry_at(&repo, commit, "src/missing.rs".into())
            .unwrap()
            .is_none()
    );
    assert!(
        entry_at(&repo, commit, "b.txt/inside".into())
            .unwrap()
            .is_none()
    );
}

#[test]
fn saves_the_bytes_the_repository_stores() {
    let fixture = fixture();
    let repo = open(&fixture);
    let blob = id(&fixture, "HEAD:src/main.rs");
    let destination = fixture.sibling("saved.rs");
    let written = save_blob(&repo, blob, &destination).unwrap();
    assert_eq!(fs::read(&destination).unwrap(), b"fn main() {}\r\n");
    assert_eq!(written, 14);
}

#[test]
fn views_a_file_whole_as_unchanged_lines() {
    let fixture = fixture();
    let repo = open(&fixture);
    let blob = id(&fixture, "HEAD:src/app/view.rs");
    let view = file_view(&repo, blob, DiffAttribute::Unspecified).unwrap();
    assert_eq!(view.content(), DiffContent::Text);
    assert_eq!((view.additions(), view.deletions()), (0, 0));
    let lines = view.lines(0, view.row_count());
    let rows: Vec<(LineKind, Option<u32>, String)> = lines
        .into_iter()
        .map(|line| (line.kind, line.new_line, line.text))
        .collect();
    assert_eq!(
        rows,
        [
            (LineKind::Context, Some(1), "one".to_owned()),
            (LineKind::Context, Some(2), "two".to_owned()),
            (LineKind::Context, Some(3), "three".to_owned()),
            (LineKind::NoNewline, None, String::new()),
        ]
    );
    assert_eq!(view.new_size(), 13);
}

#[test]
fn views_binary_files_by_size() {
    let fixture = fixture();
    fs::write(fixture.path().join("logo.bin"), b"PNG\0\x01\x02").unwrap();
    fixture.git(&["add", "logo.bin"]);
    fixture.commit("binary");
    let repo = open(&fixture);
    let blob = id(&fixture, "HEAD:logo.bin");
    let view = file_view(&repo, blob, DiffAttribute::Unspecified).unwrap();
    assert_eq!(view.content(), DiffContent::Binary);
    assert_eq!(view.row_count(), 0);
    assert_eq!(view.new_size(), 6);
    let text = file_view(&repo, blob, DiffAttribute::Text).unwrap();
    assert_eq!(text.content(), DiffContent::Text);
}
