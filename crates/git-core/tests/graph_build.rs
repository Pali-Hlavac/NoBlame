//! Building the graph from real repositories and checking it against `git log`.
#![allow(clippy::unwrap_used, clippy::expect_used)]

mod support;

use git_core::graph::{Graph, RefKind, commit_rows};
use git_core::repo::Repository;
use noblame_repo_gen::{Preset, generate, write_commit_graph};
use support::Fixture;

fn build(path: &std::path::Path) -> (gix::Repository, Graph) {
    let repo = Repository::discover(path).unwrap().local();
    let graph = Graph::build(&repo).unwrap();
    (repo, graph)
}

fn row_ids(repo: &gix::Repository, graph: &Graph) -> Vec<String> {
    let mut ids = Vec::new();
    let mut start = 0;
    while start < graph.row_count() {
        let page = commit_rows(repo, graph, start, 500).unwrap();
        start += u32::try_from(page.len()).unwrap();
        ids.extend(page.into_iter().map(|row| row.id));
    }
    ids
}

fn git_log(dir: &std::path::Path) -> Vec<String> {
    let output = std::process::Command::new("git")
        .args(["log", "--all", "--date-order", "--format=%H"])
        .current_dir(dir)
        .output()
        .unwrap();
    String::from_utf8(output.stdout)
        .unwrap()
        .lines()
        .map(str::to_owned)
        .collect()
}

#[test]
fn row_order_matches_git_log_date_order_with_and_without_commit_graph() {
    let dir = tempfile::tempdir().unwrap();
    generate(&Preset::Tiny.spec(), dir.path()).unwrap();
    let expected = git_log(dir.path());

    let (repo, without) = build(dir.path());
    assert_eq!(row_ids(&repo, &without), expected);

    write_commit_graph(dir.path()).unwrap();
    let (repo, with) = build(dir.path());
    assert!(
        Repository::discover(dir.path())
            .unwrap()
            .info()
            .has_commit_graph
    );
    assert_eq!(row_ids(&repo, &with), expected);
    assert!(with.max_lanes() > 1, "merges need more than one lane");
    for block in 0..with.block_count() {
        assert!(!with.encode_block(block).is_empty());
    }
}

#[test]
fn commits_newer_than_the_commit_graph_are_read_from_objects() {
    let fixture = Fixture::new();
    fixture.commit("first");
    fixture.git(&["commit-graph", "write", "--reachable"]);
    let newest = fixture.commit("after the commit-graph");

    let (repo, graph) = build(&fixture.path());
    assert_eq!(graph.row_count(), 2);
    let top = commit_rows(&repo, &graph, 0, 1).unwrap();
    assert_eq!(top[0].id, newest);
    assert_eq!(top[0].summary, "after the commit-graph");
}

#[test]
fn labels_branches_tags_and_head() {
    let fixture = Fixture::new();
    fixture.commit("base");
    fixture.git(&["branch", "topic"]);
    fixture.git(&["tag", "-a", "v1.0", "-m", "release"]);
    let (repo, graph) = build(&fixture.path());
    let row = &commit_rows(&repo, &graph, 0, 1).unwrap()[0];
    let labels: Vec<(&str, RefKind, bool)> = row
        .refs
        .iter()
        .map(|r| (r.name.as_str(), r.kind, r.is_head))
        .collect();
    assert_eq!(
        labels,
        [
            ("main", RefKind::LocalBranch, true),
            ("topic", RefKind::LocalBranch, false),
            ("v1.0", RefKind::Tag, false)
        ]
    );
    assert_eq!(graph.head_row(), Some(0));
}

#[test]
fn merges_are_flagged_and_detached_head_is_labelled() {
    let fixture = Fixture::new();
    fixture.commit("base");
    fixture.git(&["checkout", "--quiet", "-b", "topic"]);
    fixture.commit("topic work");
    fixture.git(&["checkout", "--quiet", "main"]);
    fixture.commit("main work");
    let merge = fixture.merge("topic", "Merge topic");
    fixture.git(&["checkout", "--quiet", "--detach", &merge]);

    let (repo, graph) = build(&fixture.path());
    let top = &commit_rows(&repo, &graph, 0, 1).unwrap()[0];
    assert_eq!(top.parent_count, 2);
    assert!(
        top.refs
            .iter()
            .any(|r| r.kind == RefKind::DetachedHead && r.is_head)
    );
    assert!(
        top.refs
            .iter()
            .all(|r| !(r.kind == RefKind::LocalBranch && r.is_head))
    );
}

#[test]
fn non_utf8_messages_are_shown_lossily() {
    let fixture = Fixture::new();
    fixture.commit_bytes(b"caf\xe9\n");
    let (repo, graph) = build(&fixture.path());
    let row = &commit_rows(&repo, &graph, 0, 1).unwrap()[0];
    assert_eq!(row.summary, "caf\u{fffd}");
}

#[test]
fn an_empty_repository_has_no_rows() {
    let fixture = Fixture::new();
    let (repo, graph) = build(&fixture.path());
    assert_eq!(graph.row_count(), 0);
    assert_eq!(graph.head_row(), None);
    assert!(commit_rows(&repo, &graph, 0, 10).unwrap().is_empty());
}

#[test]
fn shallow_clones_stop_at_the_boundary() {
    let fixture = Fixture::new();
    fixture.commit("first");
    fixture.commit("second");
    let source = format!(
        "file://{}",
        fixture.path().to_string_lossy().replace('\\', "/")
    );
    let target = fixture.sibling("shallow").to_string_lossy().into_owned();
    fixture.run(
        &fixture.sibling(""),
        &["clone", "--quiet", "--depth", "1", &source, &target],
    );
    let (_repo, graph) = build(&fixture.sibling("shallow"));
    assert_eq!(graph.row_count(), 1);
    assert_eq!(graph.missing_parents(), 0);
}
