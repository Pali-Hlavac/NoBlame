//! Command-line construction rules of `GitCommand` (no process is started).
// Test helpers may panic: a failed setup step is a failed test.
#![allow(clippy::unwrap_used, clippy::expect_used)]

use std::ffi::OsString;

use git_core::cli::{Git, GitError};

fn strings(args: Vec<OsString>) -> Vec<String> {
    args.into_iter()
        .map(|arg| arg.into_string().unwrap())
        .collect()
}

#[test]
fn every_command_gets_the_safety_overrides_first() {
    let args = strings(Git::at("git").command().arg("status").full_args());
    assert_eq!(
        args,
        [
            "-c",
            "core.quotepath=false",
            "-c",
            "color.ui=false",
            "status"
        ]
    );
}

#[test]
fn read_only_commands_skip_optional_locks() {
    let args = strings(
        Git::at("git")
            .command()
            .read_only()
            .arg("status")
            .full_args(),
    );
    let position = args.iter().position(|arg| arg == "--no-optional-locks");
    assert_eq!(
        position,
        Some(4),
        "global option must precede the subcommand: {args:?}"
    );
}

#[test]
fn options_keep_values_in_one_argument() {
    let command = Git::at("git")
        .command()
        .arg("log")
        .option("--format", "--output=/tmp/x %H");
    assert_eq!(command.display(), "git log --format=--output=/tmp/x %H");
}

#[test]
fn paths_follow_a_single_separator() {
    let command = Git::at("git")
        .command()
        .arg("add")
        .paths(["-rf", "a.txt"])
        .paths(["b.txt"]);
    assert_eq!(command.display(), "git add -- -rf a.txt b.txt");
}

#[test]
fn revisions_that_look_like_options_are_rejected() {
    let result = Git::at("git").command().arg("log").revision("--all");
    assert!(matches!(result, Err(GitError::InvalidArgument { .. })));
}
