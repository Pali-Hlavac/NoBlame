//! The highlighted history of a selected commit, checked against `git rev-list`.
#![allow(clippy::unwrap_used, clippy::expect_used)]

use std::collections::BTreeSet;

use git_core::graph::{BLOCK_ROWS, Graph, MAX_ROWS_PER_PAGE, RowGeometry, commit_rows};
use git_core::repo::Repository;
use noblame_repo_gen::{Preset, generate};

fn rev_list(dir: &std::path::Path, id: &str) -> BTreeSet<String> {
    let output = std::process::Command::new("git")
        .args(["rev-list", id])
        .current_dir(dir)
        .output()
        .unwrap();
    assert!(output.status.success());
    String::from_utf8(output.stdout)
        .unwrap()
        .lines()
        .map(str::to_owned)
        .collect()
}

#[test]
fn history_and_lit_lines_match_git() {
    let dir = tempfile::tempdir().unwrap();
    generate(&Preset::Tiny.spec(), dir.path()).unwrap();
    let repo = Repository::discover(dir.path()).unwrap().local();
    let graph = Graph::build(&repo).unwrap();
    let rows = graph.row_count();
    let ids: Vec<String> = (0..rows)
        .step_by(MAX_ROWS_PER_PAGE as usize)
        .flat_map(|start| commit_rows(&repo, &graph, start, MAX_ROWS_PER_PAGE).unwrap())
        .map(|row| row.id)
        .collect();
    assert_eq!(ids.len(), rows as usize);

    for selected in [0, 3, rows / 5, rows / 2] {
        let mut ancestry = graph.ancestry(selected).unwrap();
        let expected = rev_list(dir.path(), &ids[selected as usize]);
        let ours: BTreeSet<String> = (0..rows)
            .filter(|&row| ancestry.contains_row(row))
            .map(|row| ids[row as usize].clone())
            .collect();
        assert_eq!(ours, expected, "history of row {selected}");

        for block in 0..graph.block_count() {
            let plain = graph.block(block);
            let lit = graph.ancestry_block(&mut ancestry, block);
            assert_eq!(plain.len(), lit.len());
            for (offset, (plain_row, lit_row)) in plain.iter().zip(&lit).enumerate() {
                let row = block * BLOCK_ROWS + u32::try_from(offset).unwrap();
                // Same geometry; only the lit flags differ.
                assert_eq!(plain_row.lane, lit_row.lane);
                let shape = |geometry: &RowGeometry| {
                    let edges = geometry.edges.iter();
                    edges.map(|e| (e.from, e.to, e.color)).collect::<Vec<_>>()
                };
                assert_eq!(shape(plain_row), shape(lit_row), "row {row}");
                // Every ancestor is reached by a lit line from a child; nothing else is.
                let lit_into_node = lit_row
                    .edges
                    .iter()
                    .any(|edge| edge.lit && edge.to == lit_row.lane);
                let expected_lit = ancestry.contains_row(row) && row != selected;
                assert_eq!(
                    lit_into_node, expected_lit,
                    "selected {selected}, row {row}"
                );
            }
        }
    }
}

#[test]
fn ancestry_of_a_missing_row_is_none() {
    let dir = tempfile::tempdir().unwrap();
    generate(&Preset::Tiny.spec(), dir.path()).unwrap();
    let repo = Repository::discover(dir.path()).unwrap().local();
    let graph = Graph::build(&repo).unwrap();
    assert!(graph.ancestry(graph.row_count()).is_none());
}
