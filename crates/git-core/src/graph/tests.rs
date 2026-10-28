//! Order and layout on hand-built histories, with exact expected lanes and edges.

use super::*;

fn edge(from: u16, to: u16, color: u32) -> Edge {
    Edge {
        from,
        to,
        color,
        lit: false,
    }
}

/// Lays out every row in one pass by replaying all blocks.
fn all_rows(index: &CommitIndex, order: &[u32]) -> Vec<RowGeometry> {
    let layout = Layout::compute(index, order);
    (0..layout.block_count())
        .flat_map(|block| layout.block(index, order, block))
        .collect()
}

#[test]
fn linear_history_stays_in_one_lane() {
    // 0 ← 1 ← 2 (2 is newest)
    let index = CommitIndex::from_parents(&[1, 2, 3], &[&[], &[0], &[1]]);
    let order = date_order(&index);
    assert_eq!(order, [2, 1, 0]);
    let rows = all_rows(&index, &order);
    assert!(rows.iter().all(|row| row.lane == 0 && row.color == 0));
    assert_eq!(rows[0].edges, []);
    assert_eq!(rows[1].edges, [edge(0, 0, 0)]);
    assert_eq!(rows[2].edges, [edge(0, 0, 0)]);
}

#[test]
fn merge_opens_a_lane_that_converges_at_the_fork_point() {
    // a(0) ← b(1) on a topic, a ← c(2) on main, m(3) merges c and b.
    let index = CommitIndex::from_parents(&[1, 2, 3, 4], &[&[], &[0], &[0], &[2, 1]]);
    let order = date_order(&index);
    assert_eq!(order, [3, 2, 1, 0]);
    let rows = all_rows(&index, &order);
    // m in lane 0; c continues lane 0; the merged topic runs in lane 1 with colour 1.
    assert_eq!(
        (rows[0].lane, rows[1].lane, rows[2].lane, rows[3].lane),
        (0, 0, 1, 0)
    );
    assert_eq!(rows[1].edges, [edge(0, 0, 0), edge(0, 1, 1)]);
    assert_eq!(rows[2].edges, [edge(0, 0, 0), edge(1, 1, 1)]);
    // Both lanes wait for a and converge into its node.
    assert_eq!(rows[3].edges, [edge(0, 0, 0), edge(1, 0, 1)]);
}

#[test]
fn octopus_merge_opens_one_lane_per_extra_parent() {
    // Three roots merged by one commit.
    let index = CommitIndex::from_parents(&[1, 2, 3, 4], &[&[], &[], &[], &[0, 1, 2]]);
    let order = date_order(&index);
    let rows = all_rows(&index, &order);
    assert_eq!(rows[0].lane, 0);
    let lanes: Vec<u16> = rows[1..].iter().map(|row| row.lane).collect();
    let mut sorted = lanes.clone();
    sorted.sort_unstable();
    assert_eq!(sorted, [0, 1, 2], "each parent in its own lane: {lanes:?}");
    assert_eq!(Layout::compute(&index, &order).max_lanes, 3);
}

#[test]
fn unrelated_tips_get_separate_lanes_and_colours() {
    // Two independent branches: 0 ← 1 and 2 ← 3.
    let index = CommitIndex::from_parents(&[1, 3, 2, 4], &[&[], &[0], &[], &[2]]);
    let order = date_order(&index);
    assert_eq!(order, [3, 1, 2, 0]);
    let rows = all_rows(&index, &order);
    assert_eq!((rows[0].lane, rows[1].lane), (0, 1));
    assert_ne!(rows[0].color, rows[1].color);
}

#[test]
fn children_come_before_parents_even_with_clock_skew() {
    // The parent (0) claims to be newer than its child (1).
    let index = CommitIndex::from_parents(&[100, 1], &[&[], &[0]]);
    assert_eq!(date_order(&index), [1, 0]);
}

#[test]
fn rows_of_inverts_the_order() {
    assert_eq!(rows_of(&[2, 0, 1]), [1, 2, 0]);
}

#[test]
fn blocks_continue_seamlessly_across_checkpoints() {
    // A long chain with a side branch merged every 10 commits crosses several blocks.
    let len: u32 = BLOCK_ROWS * 3 + 17;
    let mut parents: Vec<Vec<u32>> = vec![vec![]];
    for commit in 1..len {
        let mut list = vec![commit - 1];
        if commit % 10 == 0 && commit >= 2 {
            list.push(commit - 2);
        }
        parents.push(list);
    }
    let refs: Vec<&[u32]> = parents.iter().map(Vec::as_slice).collect();
    let times: Vec<i64> = (0..i64::from(len)).collect();
    let index = CommitIndex::from_parents(&times, &refs);
    let order = date_order(&index);
    let layout = Layout::compute(&index, &order);
    let blocks: Vec<RowGeometry> = (0..layout.block_count())
        .flat_map(|block| layout.block(&index, &order, block))
        .collect();
    assert_eq!(blocks.len(), order.len());
    // Every edge must start at a lane that exists at the previous row.
    for (row, geometry) in blocks.iter().enumerate().skip(1) {
        for edge in &geometry.edges {
            assert!(edge.from < layout.max_lanes.max(1), "row {row}: {edge:?}");
        }
    }
    // Asking for a block twice gives the same answer.
    assert_eq!(
        layout.block(&index, &order, 2),
        layout.block(&index, &order, 2)
    );
    assert!(
        layout
            .block(&index, &order, layout.block_count())
            .is_empty()
    );
}
