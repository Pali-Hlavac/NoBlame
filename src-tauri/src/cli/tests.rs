//! Command-line parsing tests.

use std::path::{Path, PathBuf};

use super::*;

fn cwd() -> PathBuf {
    std::env::temp_dir().join("work")
}

fn parse_args(args: &[&str]) -> Result<LaunchRequest, clap::Error> {
    parse(
        std::iter::once("noblame").chain(args.iter().copied()),
        &cwd(),
    )
}

#[test]
fn no_arguments_open_the_main_window() {
    let request = parse_args(&[]).unwrap();
    assert_eq!(
        request,
        LaunchRequest {
            target: LaunchTarget::Main,
            path: None
        }
    );
}

#[test]
fn a_bare_path_opens_it_in_the_main_window() {
    let request = parse_args(&["repo"]).unwrap();
    assert_eq!(request.target, LaunchTarget::Main);
    assert_eq!(request.path, Some(cwd().join("repo")));
}

#[test]
fn browse_is_the_main_window_too() {
    let request = parse_args(&["browse", "repo"]).unwrap();
    assert_eq!(request.target, LaunchTarget::Main);
    assert_eq!(request.path, Some(cwd().join("repo")));
}

#[test]
fn every_task_parses_with_and_without_a_path() {
    for task in TaskKind::ALL {
        let with = parse_args(&[task.command_name(), "sub/dir"]).unwrap();
        assert_eq!(with.target, LaunchTarget::Task(task));
        assert_eq!(with.path, Some(cwd().join("sub/dir")));

        let without = parse_args(&[task.command_name()]).unwrap();
        assert_eq!(
            without.path,
            Some(cwd()),
            "{task:?} defaults to the current folder"
        );
    }
}

#[test]
fn dot_paths_are_normalized_in_the_text() {
    // `Path` equality ignores `.` components, so compare the strings the UI will show.
    let request = parse_args(&["."]).unwrap();
    let shown = request.path.unwrap().display().to_string();
    assert_eq!(shown, cwd().display().to_string());
    #[cfg(windows)]
    {
        let request = parse_args(&["commit", "a/b"]).unwrap();
        assert!(
            request
                .path
                .unwrap()
                .display()
                .to_string()
                .ends_with(r"work\a\b")
        );
    }
}

#[test]
fn absolute_paths_are_kept() {
    let absolute = std::env::temp_dir().join("elsewhere");
    let request = parse(
        ["noblame", "commit", absolute.to_str().unwrap()],
        Path::new("/x"),
    )
    .unwrap();
    assert_eq!(request.path, Some(absolute));
}

#[test]
fn help_version_and_typos_are_errors_for_the_caller_to_print() {
    use clap::error::ErrorKind;
    assert_eq!(
        parse_args(&["--help"]).unwrap_err().kind(),
        ErrorKind::DisplayHelp
    );
    assert_eq!(
        parse_args(&["--version"]).unwrap_err().kind(),
        ErrorKind::DisplayVersion
    );
    assert!(parse_args(&["commit", "a", "b"]).is_err());
    assert!(parse_args(&["--frobnicate"]).is_err());
}

#[test]
fn help_lists_every_task() {
    let help = command().render_help().to_string();
    for task in TaskKind::ALL {
        assert!(
            help.contains(task.command_name()),
            "missing {}",
            task.command_name()
        );
    }
}

#[test]
fn clap_definition_is_valid() {
    command().debug_assert();
}
