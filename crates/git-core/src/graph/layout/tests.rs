//! The fast full pass gives exactly the checkpoints of the row-by-row step.

use super::*;
use crate::graph::date_order;

/// The checkpoints and width the row-by-row step reaches (the previous `Layout::compute`).
fn reference(index: &CommitIndex, order: &[u32]) -> (Vec<LaneState>, u16) {
    let mut state = LaneState::default();
    let mut checkpoints = Vec::new();
    let mut max_lanes = 0;
    let mut row = RowGeometry::default();
    for (number, &commit) in order.iter().enumerate() {
        if number % BLOCK_ROWS as usize == 0 {
            checkpoints.push(state.clone());
        }
        state.step(commit, index.parents(commit), false, &mut row);
        max_lanes = max_lanes.max(lane_id(state.lanes.len()));
    }
    (checkpoints, max_lanes)
}

/// A random history: each commit has one to three parents among older commits, often far
/// back, so many lanes stay open (like the Linux kernel's long-lived merges).
fn random_history(commits: u32, seed: u64) -> CommitIndex {
    let mut state = seed;
    let mut next = move |bound: u32| {
        state = state
            .wrapping_mul(6_364_136_223_846_793_005)
            .wrapping_add(1_442_695_040_888_963_407);
        u32::try_from((state >> 33) % u64::from(bound.max(1))).unwrap_or(0)
    };
    let times: Vec<i64> = (0..commits).map(i64::from).collect();
    let parents: Vec<Vec<u32>> = (0..commits)
        .map(|commit| {
            if commit == 0 {
                return Vec::new();
            }
            let count = 1 + next(10).saturating_sub(7); // mostly one parent, some merges
            let mut list = vec![commit - 1 - next(commit.min(40))];
            for _ in 1..count {
                let parent = next(commit);
                if !list.contains(&parent) {
                    list.push(parent);
                }
            }
            list
        })
        .collect();
    let refs: Vec<&[u32]> = parents.iter().map(Vec::as_slice).collect();
    CommitIndex::from_parents(&times, &refs)
}

#[test]
fn fast_checkpoints_match_the_row_by_row_step() {
    for seed in 1..=6 {
        let index = random_history(3_000, seed);
        let order = date_order(&index);
        let fast = Layout::compute(&index, &order);
        let (checkpoints, max_lanes) = reference(&index, &order);
        assert_eq!(fast.checkpoints.len(), checkpoints.len(), "seed {seed}");
        for (block, (ours, theirs)) in fast.checkpoints.iter().zip(&checkpoints).enumerate() {
            assert_eq!(ours, theirs, "seed {seed}, block {block}");
        }
        assert_eq!(fast.max_lanes, max_lanes, "seed {seed}");
        assert!(
            max_lanes > 10,
            "the history should be wide (seed {seed}: {max_lanes})"
        );
    }
}
