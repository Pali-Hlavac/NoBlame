//! Generates the tiny preset with the real `git` and checks the resulting repository.
// Test helpers may panic: a failed setup step is a failed test.
#![allow(clippy::unwrap_used, clippy::expect_used)]

use std::path::Path;
use std::process::Command;

use noblame_repo_gen::{Preset, generate, write_commit_graph};

fn git(dir: &Path, args: &[&str]) -> String {
    let output = Command::new("git")
        .args(args)
        .current_dir(dir)
        .output()
        .unwrap();
    assert!(output.status.success(), "git {args:?} failed: {output:?}");
    String::from_utf8(output.stdout).unwrap().trim().to_owned()
}

#[test]
fn tiny_preset_has_the_requested_shape() {
    let dir = tempfile::tempdir().unwrap();
    let spec = Preset::Tiny.spec();
    let summary = generate(&spec, dir.path()).unwrap();
    write_commit_graph(dir.path()).unwrap();

    assert_eq!(summary.commits, spec.commits);
    assert_eq!(
        git(dir.path(), &["rev-list", "--all", "--count"]),
        spec.commits.to_string()
    );
    assert!(summary.merges > 0, "expected merges: {summary:?}");
    let merges = git(dir.path(), &["rev-list", "--all", "--merges", "--count"]);
    assert_eq!(merges, summary.merges.to_string());
    assert_eq!(git(dir.path(), &["branch", "--show-current"]), "main");
    assert_eq!(
        git(dir.path(), &["status", "--porcelain"]),
        "",
        "work tree is clean"
    );
    assert!(dir.path().join(".git/objects/info/commit-graph").is_file());
    let tags = git(dir.path(), &["tag", "--list"]);
    assert_eq!(tags.lines().count(), summary.tags as usize);
    let remotes = git(dir.path(), &["branch", "--remotes"]);
    assert!(remotes.contains("origin/main"));
}

#[test]
fn same_spec_yields_the_same_commits() {
    let (a, b) = (tempfile::tempdir().unwrap(), tempfile::tempdir().unwrap());
    let spec = Preset::Tiny.spec();
    generate(&spec, a.path()).unwrap();
    generate(&spec, b.path()).unwrap();
    assert_eq!(
        git(a.path(), &["rev-parse", "main"]),
        git(b.path(), &["rev-parse", "main"])
    );
}

#[test]
fn refuses_a_non_empty_directory() {
    let dir = tempfile::tempdir().unwrap();
    std::fs::write(dir.path().join("keep.txt"), b"x").unwrap();
    assert!(generate(&Preset::Tiny.spec(), dir.path()).is_err());
}
