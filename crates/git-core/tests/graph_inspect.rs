//! Commit details and "contained in" answered from the graph, checked against git itself.
#![allow(clippy::unwrap_used, clippy::expect_used)]

mod support;

use std::collections::BTreeSet;

use git_core::graph::{Graph, RefKind, commit_details, commit_rows};
use git_core::repo::Repository;
use noblame_repo_gen::{Preset, generate};
use support::Fixture;

fn build(path: &std::path::Path) -> (gix::Repository, Graph) {
    let repo = Repository::discover(path).unwrap().local();
    let graph = Graph::build(&repo).unwrap();
    (repo, graph)
}

fn git(dir: &std::path::Path, args: &[&str]) -> String {
    let output = std::process::Command::new("git")
        .args(args)
        .current_dir(dir)
        .output()
        .unwrap();
    assert!(output.status.success(), "git {args:?} failed");
    String::from_utf8(output.stdout).unwrap()
}

/// Short names of the branches, remote branches and tags git says contain `id`.
fn git_containing(dir: &std::path::Path, id: &str) -> BTreeSet<String> {
    git(
        dir,
        &[
            "for-each-ref",
            "--format=%(refname:short)",
            &format!("--contains={id}"),
            "refs/heads",
            "refs/remotes",
            "refs/tags",
        ],
    )
    .lines()
    .filter(|name| !name.ends_with("/HEAD"))
    .map(str::to_owned)
    .collect()
}

#[test]
fn contained_in_matches_git_for_each_ref_contains() {
    let dir = tempfile::tempdir().unwrap();
    generate(&Preset::Tiny.spec(), dir.path()).unwrap();
    let (repo, graph) = build(dir.path());
    let rows = graph.row_count();
    for row in [0, 1, rows / 7, rows / 3, rows / 2, rows - 2, rows - 1] {
        let details = commit_details(&repo, &graph, row).unwrap();
        let ours: BTreeSet<String> = details
            .contained_in
            .iter()
            .filter(|reference| reference.kind != RefKind::DetachedHead)
            .map(|reference| reference.name.clone())
            .collect();
        assert_eq!(
            ours,
            git_containing(dir.path(), &details.id),
            "row {row} ({})",
            details.id
        );
        assert_eq!(
            details.contained_in_total as usize,
            details.contained_in.len()
        );
    }
}

#[test]
fn details_carry_message_people_and_parents() {
    let fixture = Fixture::new();
    fixture.commit("base");
    fixture.git(&["checkout", "--quiet", "-b", "topic"]);
    let topic = fixture.commit("topic work");
    fixture.git(&["checkout", "--quiet", "main"]);
    let main = fixture.commit("main work");
    fixture.git(&["tag", "v1"]);
    let merge = fixture.merge("topic", "Merge topic\n\nWith a body.");

    let (repo, graph) = build(&fixture.path());
    let details = commit_details(&repo, &graph, 0).unwrap();
    assert_eq!(details.id, merge);
    assert_eq!(details.message.trim_end(), "Merge topic\n\nWith a body.");
    let parents: Vec<&str> = details.parents.iter().map(|p| p.id.as_str()).collect();
    assert_eq!(parents, [main.as_str(), topic.as_str()]);
    for parent in &details.parents {
        let row = &commit_rows(&repo, &graph, parent.row, 1).unwrap()[0];
        assert_eq!(row.id, parent.id);
    }
    let expected_time: i64 = fixture
        .git(&["log", "-1", "--format=%at", &merge])
        .parse()
        .unwrap();
    assert_eq!(details.author.time, expected_time);
    assert!(!details.committer.name.is_empty());
    let names: Vec<&str> = details.refs.iter().map(|r| r.name.as_str()).collect();
    assert_eq!(names, ["main"]);

    // The tagged commit is contained in main and in its own tag, but not in topic.
    let tagged_row = graph
        .refs_with_rows()
        .into_iter()
        .find_map(|(reference, row)| (reference.name == "v1").then_some(row).flatten());
    let tagged = commit_details(&repo, &graph, tagged_row.unwrap()).unwrap();
    let containing: Vec<&str> = tagged
        .contained_in
        .iter()
        .map(|r| r.name.as_str())
        .collect();
    assert_eq!(containing, ["main", "v1"]);
}
