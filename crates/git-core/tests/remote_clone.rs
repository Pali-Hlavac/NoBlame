//! Cloning as a job would (checked folder, options, cleanup after a cancel), through the real
//! `git`.
#![allow(clippy::unwrap_used, clippy::expect_used)]

mod support;

use std::fs;
use std::path::Path;

use git_core::cli::Git;
use git_core::remote::{
    CloneError, CloneFilter, CloneOptions, CloneTarget, check_clone_target, clone_command,
    remove_partial_clone,
};
use support::Fixture;
use tokio_util::sync::CancellationToken;

/// A repository with two commits on `main` and a `topic` branch.
fn origin() -> Fixture {
    let origin = Fixture::new();
    origin.git(&["config", "core.autocrlf", "false"]);
    for text in [
        "one
", "two
",
    ] {
        fs::write(origin.path().join("a.txt"), text).unwrap();
        origin.git(&["add", "a.txt"]);
        origin.commit(text.trim());
    }
    origin.git(&["branch", "topic"]);
    origin
}

#[test]
fn checks_where_a_clone_goes() {
    let origin = origin();
    assert!(matches!(
        check_clone_target(Path::new("relative/x")),
        Err(CloneError::Relative(_))
    ));
    assert!(matches!(
        check_clone_target(&origin.path()),
        Err(CloneError::NotEmpty(_))
    ));
    assert!(matches!(
        check_clone_target(&origin.path().join("a.txt")),
        Err(CloneError::NotAFolder(_))
    ));
    let nested = origin.sibling("new/deeper/repo");
    let target = check_clone_target(&nested).unwrap();
    assert_eq!((target.existed, target.run_in), (false, origin.sibling("")));
    fs::create_dir(origin.sibling("empty")).unwrap();
    assert!(
        check_clone_target(&origin.sibling("empty"))
            .unwrap()
            .existed
    );
}

#[tokio::test]
async fn clones_shallow_single_branch_and_cleans_up() {
    let origin = origin();
    // file:// so --depth applies (a plain folder path clones locally and ignores it).
    let path = origin.path().to_str().unwrap().replace('\\', "/");
    let url = if path.starts_with('/') {
        format!("file://{path}")
    } else {
        format!("file:///{path}")
    };
    let folder = origin.sibling("copies/shallow");
    let target = check_clone_target(&folder).unwrap();
    let options = CloneOptions {
        url,
        branch: Some("topic".into()),
        depth: Some(1),
        single_branch: true,
        filter: CloneFilter::Blobless,
        recurse_submodules: true,
    };
    let command = clone_command(&Git::locate().unwrap(), &target, &options).unwrap();
    let line = command.display();
    assert!(
        line.starts_with(
            "git clone --progress --branch=topic --depth=1 --single-branch --filter=blob:none --recurse-submodules -- file://"
        ),
        "{line}"
    );
    let output = command
        .stream(&CancellationToken::new(), |_| {})
        .await
        .unwrap();
    assert!(output.success(), "{}", output.stderr_lossy());
    assert!(folder.join(".git/shallow").exists());
    assert_eq!(origin.run(&folder, &["branch", "--show-current"]), "topic");
    assert_eq!(origin.run(&folder, &["rev-list", "--count", "HEAD"]), "1");

    // What a cancelled clone left goes: the folder it made, or what it wrote in an empty one.
    remove_partial_clone(&target).unwrap();
    assert!(!folder.exists());
    let empty = origin.sibling("empty");
    fs::create_dir_all(empty.join("half/.git")).unwrap();
    fs::write(empty.join("half.txt"), "x").unwrap();
    let given = CloneTarget {
        folder: empty.clone(),
        existed: true,
        run_in: origin.sibling(""),
    };
    remove_partial_clone(&given).unwrap();
    assert!(empty.is_dir() && fs::read_dir(&empty).unwrap().next().is_none());
}
