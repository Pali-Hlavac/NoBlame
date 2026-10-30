//! Finding commits and resolving revisions, checked against git.
#![allow(clippy::unwrap_used, clippy::expect_used)]

use std::collections::BTreeSet;
use std::sync::Arc;

use git_core::graph::{
    Graph, GraphError, GraphFilter, Located, MAX_ROWS_PER_PAGE, Tips, commit_rows, resolve_commit,
};
use git_core::repo::Repository;
use noblame_repo_gen::{Preset, generate};
use tokio_util::sync::CancellationToken;

fn git(dir: &std::path::Path, args: &[&str]) -> Vec<String> {
    let output = std::process::Command::new("git")
        .args(args)
        .current_dir(dir)
        .output()
        .unwrap();
    assert!(output.status.success(), "{args:?}");
    String::from_utf8(output.stdout)
        .unwrap()
        .lines()
        .map(str::to_owned)
        .collect()
}

#[test]
fn finds_ids_refs_and_authors() {
    let dir = tempfile::tempdir().unwrap();
    generate(&Preset::Tiny.spec(), dir.path()).unwrap();
    let opened = Repository::discover(dir.path()).unwrap();
    let repo = opened.local();
    let graph = Graph::build(&repo).unwrap();
    let rows: Vec<_> = (0..graph.row_count())
        .step_by(MAX_ROWS_PER_PAGE as usize)
        .flat_map(|start| commit_rows(&repo, &graph, start, MAX_ROWS_PER_PAGE).unwrap())
        .collect();
    let cancel = CancellationToken::new();
    let find = |query: &str| {
        graph
            .find_rows(&opened.thread_safe(), query, &cancel)
            .unwrap()
    };

    // An abbreviated id finds its commit (and ids are not matched below 4 digits).
    let fifth = &rows[5];
    assert!(find(&fifth.id[..10].to_uppercase()).contains(&5));
    // A branch name finds its tip.
    let branch = rows.iter().find_map(|row| row.refs.first()).unwrap();
    let tip = rows
        .iter()
        .position(|row| row.refs.contains(branch))
        .unwrap();
    assert!(find(&branch.name).contains(&u32::try_from(tip).unwrap()));
    // An author word finds what git log --author finds (here no message or ref contains it).
    let word = rows[0]
        .author_name
        .split_whitespace()
        .last()
        .unwrap()
        .to_owned();
    let expected: BTreeSet<u32> = git(
        dir.path(),
        &[
            "log",
            "--all",
            "-i",
            "-F",
            "--format=%H",
            &format!("--author={word}"),
        ],
    )
    .into_iter()
    .map(|id| u32::try_from(rows.iter().position(|row| row.id == id).unwrap()).unwrap())
    .collect();
    let found: BTreeSet<u32> = find(&word).into_iter().collect();
    assert!(found.is_superset(&expected) && !expected.is_empty());
    assert!(find("  ").is_empty());
}

#[test]
fn resolves_revisions_and_locates_them() {
    let dir = tempfile::tempdir().unwrap();
    generate(&Preset::Tiny.spec(), dir.path()).unwrap();
    let repo = Repository::discover(dir.path()).unwrap().local();
    let full = Arc::new(Graph::build(&repo).unwrap());

    let parent = resolve_commit(&repo, "HEAD~1").unwrap();
    assert_eq!(
        parent.to_string(),
        git(dir.path(), &["rev-parse", "HEAD~1"])[0]
    );
    let short = &parent.to_string()[..8];
    assert_eq!(resolve_commit(&repo, short).unwrap(), parent);
    assert!(matches!(
        resolve_commit(&repo, "no-such-branch"),
        Err(GraphError::UnknownRevision(_))
    ));

    assert!(matches!(full.locate(&parent), Located::Shown(_)));
    // HEAD's history with first parents only hides commits of merged branches.
    let view = full.filtered(&GraphFilter {
        tips: Tips::Head,
        first_parent: true,
        ..GraphFilter::default()
    });
    let side = git(
        dir.path(),
        &["rev-list", "--all", "--not", "--first-parent", "HEAD"],
    );
    let hidden = gix::ObjectId::from_hex(side[0].as_bytes()).unwrap();
    assert_eq!(view.locate(&hidden), Located::Hidden);
}
