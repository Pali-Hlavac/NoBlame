//! Submodule state, initializing and updating, and the commits between two pointers.
#![allow(clippy::unwrap_used, clippy::expect_used)]

mod support;

use std::path::Path;

use git_core::cli::Git;
use git_core::repo::Repository;
use git_core::submodule::{
    PointerChange, SubmoduleEntry, list_submodules, pointer_log, submodule_dir, update_command,
    updated_count,
};
use support::Fixture;
use tokio_util::sync::CancellationToken;

/// Local file URLs are blocked for submodules by default since git 2.38.
const ALLOW_FILE: [&str; 2] = ["-c", "protocol.file.allow=always"];

fn git() -> Git {
    Git::locate().expect("tests need git on PATH")
}

/// A repository `leaf` with commits `one` and `two` next to the fixture, added to it as the
/// submodule `deps/leaf` at `one`; the fixture is then cloned without its submodules into
/// `clone`. Returns the ids of `one` and `two`.
fn superproject(fixture: &Fixture) -> (String, String) {
    fixture.commit("base");
    let leaf = fixture.sibling("leaf");
    let leaf_text = leaf.to_string_lossy().into_owned();
    fixture.run(
        &fixture.sibling(""),
        &["init", "--quiet", "--initial-branch=main", &leaf_text],
    );
    let mut ids = Vec::new();
    for name in ["one", "two"] {
        std::fs::write(leaf.join(name), name).unwrap();
        fixture.run(&leaf, &["add", name]);
        fixture.run(&leaf, &["commit", "--quiet", "-m", name]);
        ids.push(fixture.run(&leaf, &["rev-parse", "HEAD"]));
    }
    let mut args = ALLOW_FILE.to_vec();
    args.extend(["submodule", "--quiet", "add", &leaf_text, "deps/leaf"]);
    fixture.git(&args);
    fixture.run(
        &fixture.path().join("deps/leaf"),
        &["checkout", "--quiet", &ids[0]],
    );
    fixture.git(&["add", "deps/leaf"]);
    fixture.git(&["commit", "--quiet", "-m", "add leaf"]);
    let clone = fixture.sibling("clone").to_string_lossy().into_owned();
    let source = fixture.path().to_string_lossy().into_owned();
    fixture.run(&fixture.sibling(""), &["clone", "--quiet", &source, &clone]);
    (ids[0].clone(), ids[1].clone())
}

fn list(path: &Path) -> Vec<SubmoduleEntry> {
    list_submodules(&Repository::discover(path).unwrap().local()).unwrap()
}

#[test]
fn a_submodule_checked_out_elsewhere_shows_both_commits() {
    let fixture = Fixture::new();
    let (one, two) = superproject(&fixture);
    let listed = list(&fixture.path());
    assert_eq!(listed[0].recorded.as_deref(), Some(one.as_str()));
    assert_eq!(listed[0].checked_out.as_deref(), Some(one.as_str()));

    fixture.run(
        &fixture.path().join("deps/leaf"),
        &["checkout", "--quiet", &two],
    );
    let listed = list(&fixture.path());
    assert_eq!(listed[0].recorded.as_deref(), Some(one.as_str()));
    assert_eq!(listed[0].checked_out.as_deref(), Some(two.as_str()));

    let clone = list(&fixture.sibling("clone"));
    assert!(!clone[0].initialized);
    assert_eq!(clone[0].recorded.as_deref(), Some(one.as_str()));
    assert_eq!(clone[0].checked_out, None);
}

#[tokio::test]
async fn update_initializes_and_puts_submodules_back() {
    let fixture = Fixture::new();
    let (one, two) = superproject(&fixture);
    let clone = fixture.sibling("clone");
    let output = update_command(&git(), &clone, &["deps/leaf".to_owned()])
        .env("GIT_CONFIG_COUNT", "1")
        .env("GIT_CONFIG_KEY_0", "protocol.file.allow")
        .env("GIT_CONFIG_VALUE_0", "always")
        .output(&CancellationToken::new())
        .await
        .unwrap();
    assert!(output.success(), "{}", output.combined());
    assert_eq!(updated_count(&output.combined()), 1);
    let listed = list(&clone);
    assert!(listed[0].initialized);
    assert_eq!(listed[0].checked_out.as_deref(), Some(one.as_str()));

    fixture.run(&clone.join("deps/leaf"), &["checkout", "--quiet", &two]);
    let output = update_command(&git(), &clone, &[])
        .output(&CancellationToken::new())
        .await
        .unwrap();
    assert!(output.success(), "{}", output.combined());
    assert_eq!(list(&clone)[0].checked_out.as_deref(), Some(one.as_str()));
}

#[tokio::test]
async fn the_log_lists_the_commits_between_two_pointers() {
    let fixture = Fixture::new();
    let (one, two) = superproject(&fixture);
    let dir = submodule_dir(&fixture.path(), "deps/leaf").unwrap();
    let cancel = CancellationToken::new();

    let PointerChange::Log(log) = pointer_log(&git(), &dir, &one, &two, &cancel)
        .await
        .unwrap()
    else {
        panic!("expected a log");
    };
    assert_eq!(log.to, two);
    assert_eq!(log.added.len(), 1);
    assert_eq!(log.added[0].summary, "two");
    assert!(log.removed.is_empty() && !log.more_added);

    // Back: the commit is removed. HEAD is what is checked out (one).
    let PointerChange::Log(log) = pointer_log(&git(), &dir, &two, "HEAD", &cancel)
        .await
        .unwrap()
    else {
        panic!("expected a log");
    };
    assert_eq!(log.to, one);
    assert_eq!(log.removed.len(), 1);
    assert!(log.added.is_empty());

    let missing = "0123456789012345678901234567890123456789";
    assert_eq!(
        pointer_log(&git(), &dir, &one, missing, &cancel)
            .await
            .unwrap(),
        PointerChange::Missing
    );
    let not_cloned = submodule_dir(&fixture.sibling("clone"), "deps/leaf").unwrap();
    assert_eq!(
        pointer_log(&git(), &not_cloned, &one, &two, &cancel)
            .await
            .unwrap(),
        PointerChange::NotCheckedOut
    );
}

#[test]
fn submodule_paths_stay_inside_the_work_tree() {
    let root = Path::new("/repo");
    assert!(submodule_dir(root, "deps/leaf").is_ok());
    for path in ["", "../other", "deps/../../x", "/etc"] {
        assert!(submodule_dir(root, path).is_err(), "{path}");
    }
}
