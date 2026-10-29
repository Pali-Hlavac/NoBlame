//! Filters and filtered views on hand-built histories.
#![allow(clippy::cast_possible_truncation, clippy::cast_possible_wrap)]

use std::collections::HashMap;
use std::sync::Arc;

use gix::ObjectId;

use super::*;

/// A graph of `parents` (commit `i` has time `i + 1`) with local branches `(name, commit)`.
fn graph(parents: &[&[u32]], branches: &[(&str, u32)], head: Option<u32>) -> Arc<Graph> {
    let times: Vec<i64> = (1..=parents.len() as i64).collect();
    let index = CommitIndex::from_parents(&times, parents);
    let order = date_order(&index);
    let mut refs_by_commit: HashMap<u32, Vec<u32>> = HashMap::new();
    for (number, &(_, commit)) in branches.iter().enumerate() {
        refs_by_commit
            .entry(commit)
            .or_default()
            .push(number as u32);
    }
    Arc::new(Graph {
        layout: Layout::compute(&index, &order),
        rows_of: rows_of(&order),
        order,
        index,
        refs: branches
            .iter()
            .map(|&(name, _)| GraphRef {
                name: name.to_owned(),
                kind: RefKind::LocalBranch,
                target: ObjectId::null(gix::hash::Kind::Sha1),
                is_head: false,
            })
            .collect(),
        refs_by_commit,
        head_commit: head,
        timings: BuildTimings::default(),
        source: None,
    })
}

/// The full graph's commit on each row of `view`.
fn shown(view: &Graph) -> Vec<u32> {
    (0..view.row_count())
        .map(|row| view.full().order[view.full_row(row).unwrap() as usize])
        .collect()
}

/// The parents `view` draws for the full graph's `commit`, as full commits.
fn parents_in(view: &Graph, commit: u32) -> Vec<u32> {
    let rows = shown(view);
    let row = rows.iter().position(|&shown| shown == commit).unwrap();
    view.index
        .parents(row as u32)
        .iter()
        .map(|&p| rows[p as usize])
        .collect()
}

fn mask(len: usize, shown: &[u32]) -> Vec<bool> {
    (0..len as u32)
        .map(|commit| shown.contains(&commit))
        .collect()
}

/// a(0) ← b(1) on a topic, a ← c(2) on main, m(3) merges c and b, d(4) on top.
const MERGE: &[&[u32]] = &[&[], &[0], &[0], &[2, 1], &[3]];

#[test]
fn hidden_commits_are_skipped_by_the_lines() {
    let full = graph(&[&[], &[0], &[1], &[2]], &[], None);
    let view = full.view(&mask(4, &[0, 3]), false);
    assert_eq!(shown(&view), [3, 0]);
    assert_eq!(parents_in(&view, 3), [0]);
    assert_eq!(view.block_count(), 1);
}

#[test]
fn a_hidden_merge_joins_its_child_to_both_sides() {
    let full = graph(MERGE, &[], None);
    let view = full.view(
        &full.shown_by(&GraphFilter {
            no_merges: true,
            ..GraphFilter::default()
        }),
        false,
    );
    assert_eq!(shown(&view), [4, 2, 1, 0]);
    assert_eq!(parents_in(&view, 4), [2, 1]);
    // Two lines, but d is not a merge.
    assert_eq!(view.parent_count(0), 1);
}

#[test]
fn first_parent_follows_and_draws_first_parents_only() {
    let full = graph(MERGE, &[("main", 4)], None);
    let view = full.filtered(&GraphFilter {
        first_parent: true,
        ..GraphFilter::default()
    });
    assert_eq!(shown(&view), [4, 3, 2, 0]);
    assert_eq!(parents_in(&view, 3), [2]);
    assert_eq!(view.parent_count(1), 2, "m is still a merge");
    assert_eq!(view.max_lanes(), 1);
}

#[test]
fn a_branch_shows_its_own_history() {
    let full = graph(MERGE, &[("main", 2), ("topic", 1)], None);
    let topic = full.filtered(&GraphFilter {
        tips: Tips::Refs(vec![RefSelector {
            kind: RefKind::LocalBranch,
            name: "topic".to_owned(),
        }]),
        ..GraphFilter::default()
    });
    assert_eq!(shown(&topic), [1, 0]);
    assert_eq!(
        topic
            .refs_of(0)
            .map(|r| r.name.as_str())
            .collect::<Vec<_>>(),
        ["topic"]
    );
    let gone = full.filtered(&GraphFilter {
        tips: Tips::Refs(vec![RefSelector {
            kind: RefKind::Tag,
            name: "topic".to_owned(),
        }]),
        ..GraphFilter::default()
    });
    assert_eq!(gone.row_count(), 0);
}

#[test]
fn head_shows_the_history_of_head() {
    let full = graph(MERGE, &[], Some(1));
    let view = full.filtered(&GraphFilter {
        tips: Tips::Head,
        ..GraphFilter::default()
    });
    assert_eq!(shown(&view), [1, 0]);
    assert_eq!(view.head_row(), Some(0));
}

#[test]
fn rows_map_between_the_view_and_the_full_graph() {
    let full = graph(MERGE, &[], None);
    let view = full.view(&mask(5, &[4, 1]), false);
    // Full rows: d, m, c, b, a.
    assert_eq!(
        (view.full_row(0), view.full_row(1), view.full_row(2)),
        (Some(0), Some(3), None)
    );
    assert_eq!((view.shown_row(3), view.shown_row(1)), (Some(1), None));
    assert!(view.is_filtered() && !full.is_filtered());
    assert_eq!(full.shown_row(4), Some(4));
}

#[test]
fn a_very_wide_hidden_merge_keeps_the_first_lines() {
    // 40 roots, one hidden octopus merge of all of them, and a child on top.
    let roots: Vec<u32> = (0..40).collect();
    let mut parents: Vec<&[u32]> = vec![&[]; 40];
    parents.push(&roots);
    parents.push(&[40]);
    let full = graph(&parents, &[], None);
    let mut keep = vec![true; 42];
    keep[40] = false;
    let view = full.view(&keep, false);
    assert_eq!(view.row_count(), 41);
    assert_eq!(view.index.parents(0).len(), 32);
}
