//! Building the graph from an earlier index gives exactly what a full build gives.
#![allow(clippy::unwrap_used, clippy::expect_used)]

mod support;

use git_core::graph::{CommitIndex, Graph};
use git_core::repo::Repository;
use support::Fixture;

fn local(fixture: &Fixture) -> gix::Repository {
    Repository::discover(&fixture.path()).unwrap().local()
}

/// A row's node lane and its edges (from, to, colour).
type RowShape = (u16, Vec<(u16, u16, u32)>);

/// Rows (commit ids top to bottom) and every block's geometry.
fn shape(graph: &Graph) -> (Vec<String>, Vec<Vec<RowShape>>) {
    let ids = (0..graph.row_count())
        .map(|row| graph.id_at(row).unwrap().to_string())
        .collect();
    let blocks = (0..graph.block_count())
        .map(|block| {
            graph
                .block(block)
                .iter()
                .map(|row| {
                    let edges = row.edges.iter().map(|e| (e.from, e.to, e.color)).collect();
                    (row.lane, edges)
                })
                .collect()
        })
        .collect();
    (ids, blocks)
}

#[test]
fn reusing_an_index_matches_a_full_build() {
    let fixture = Fixture::new();
    fixture.commit("base");
    fixture.git(&["checkout", "--quiet", "-b", "topic"]);
    fixture.commit("topic 1");
    fixture.commit("topic 2");
    fixture.git(&["checkout", "--quiet", "-b", "doomed", "main"]);
    fixture.commit("doomed work");
    fixture.git(&["checkout", "--quiet", "main"]);
    fixture.commit("main 1");
    // Half the history in the commit-graph file, half only in objects.
    fixture.git(&["commit-graph", "write", "--reachable"]);
    let before = Graph::build(&local(&fixture)).unwrap();

    fixture.merge("topic", "merge topic");
    fixture.commit("main 2");
    fixture.git(&["branch", "--quiet", "-D", "doomed"]);

    let repo = local(&fixture);
    assert!(before.index().reusable(&repo));
    let incremental = Graph::build_with(&repo, Some(before.index())).unwrap();
    let full = Graph::build(&repo).unwrap();
    assert_eq!(shape(&incremental), shape(&full));
    // The deleted branch's commit is gone; the new ones are there.
    assert_eq!(incremental.row_count(), 6);
}

#[test]
fn a_cached_index_survives_the_round_trip() {
    let fixture = Fixture::new();
    fixture.commit("one");
    fixture.commit("two");
    let graph = Graph::build(&local(&fixture)).unwrap();
    let mut bytes = Vec::new();
    graph.index().write_to(&mut bytes).unwrap();
    let cached = CommitIndex::read_from(&bytes).unwrap();

    fixture.commit("three");
    let repo = local(&fixture);
    let from_cache = Graph::build_with(&repo, Some(&cached)).unwrap();
    assert_eq!(shape(&from_cache), shape(&Graph::build(&repo).unwrap()));
}

#[test]
fn shallow_clones_are_not_reused() {
    let fixture = Fixture::new();
    fixture.commit("one");
    fixture.commit("two");
    let source = fixture.path().to_string_lossy().into_owned();
    let clone = fixture.sibling("shallow");
    let clone_arg = clone.to_string_lossy().into_owned();
    fixture.run(
        &fixture.sibling(""),
        &[
            "clone",
            "--quiet",
            "--depth",
            "1",
            &format!("file://{source}"),
            &clone_arg,
        ],
    );
    let repo = Repository::discover(&clone).unwrap().local();
    let graph = Graph::build(&repo).unwrap();
    assert!(!graph.index().reusable(&repo));
}
