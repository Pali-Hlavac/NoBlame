//! Listing nested submodules with gix.
#![allow(clippy::unwrap_used, clippy::expect_used)]

mod support;

use std::path::Path;

use git_core::repo::Repository;
use git_core::submodule::{SubmoduleEntry, list_submodules};
use support::Fixture;

/// Local file URLs are blocked for submodules by default since git 2.38.
const ALLOW_FILE: [&str; 2] = ["-c", "protocol.file.allow=always"];

/// A repository with one commit next to the fixture's repository.
fn sibling_repo(fixture: &Fixture, name: &str) -> String {
    let dir = fixture.sibling(name);
    let dir_text = dir.to_string_lossy().into_owned();
    fixture.run(
        &fixture.sibling(""),
        &["init", "--quiet", "--initial-branch=main", &dir_text],
    );
    std::fs::write(dir.join("README"), name).unwrap();
    fixture.run(&dir, &["add", "README"]);
    fixture.run(&dir, &["commit", "--quiet", "-m", name]);
    dir_text
}

fn add_submodule(fixture: &Fixture, cwd: &Path, url: &str, path: &str) {
    let mut args = ALLOW_FILE.to_vec();
    args.extend(["submodule", "--quiet", "add", url, path]);
    fixture.run(cwd, &args);
    fixture.run(cwd, &["commit", "--quiet", "-m", &format!("add {path}")]);
}

fn list(path: &Path) -> Vec<SubmoduleEntry> {
    list_submodules(&Repository::discover(path).unwrap().local()).unwrap()
}

#[test]
fn a_repository_without_submodules_has_none() {
    let fixture = Fixture::new();
    fixture.commit("base");
    assert!(list(&fixture.path()).is_empty());
}

#[test]
fn nested_submodules_are_listed_as_a_tree() {
    let fixture = Fixture::new();
    fixture.commit("base");
    let leaf = sibling_repo(&fixture, "leaf");
    let middle = sibling_repo(&fixture, "middle");
    add_submodule(&fixture, &fixture.sibling("middle"), &leaf, "deps/leaf");
    add_submodule(&fixture, &fixture.path(), &middle, "libs/middle");
    let mut args = ALLOW_FILE.to_vec();
    args.extend(["submodule", "--quiet", "update", "--init", "--recursive"]);
    fixture.git(&args);

    let top = list(&fixture.path());
    assert_eq!(top.len(), 1);
    assert_eq!(top[0].path, "libs/middle");
    assert!(top[0].initialized);
    // Native separators, so it matches the path a folder picker would give.
    let expected = fixture.path().join("libs").join("middle");
    assert_eq!(top[0].work_dir, expected.to_string_lossy());
    assert_eq!(top[0].children.len(), 1);
    assert_eq!(top[0].children[0].path, "deps/leaf");
    assert!(top[0].children[0].initialized);
}

#[test]
fn submodules_that_are_not_cloned_are_not_initialized() {
    let fixture = Fixture::new();
    fixture.commit("base");
    let leaf = sibling_repo(&fixture, "leaf");
    add_submodule(&fixture, &fixture.path(), &leaf, "deps/leaf");
    let clone = fixture.sibling("clone").to_string_lossy().into_owned();
    let source = fixture.path().to_string_lossy().into_owned();
    fixture.run(&fixture.sibling(""), &["clone", "--quiet", &source, &clone]);

    let listed = list(&fixture.sibling("clone"));
    assert_eq!(listed.len(), 1);
    assert_eq!(listed[0].name, "deps/leaf");
    assert!(!listed[0].initialized);
    assert!(listed[0].children.is_empty());
}
