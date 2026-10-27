//! Row order of the graph: newest first by committer date, but a commit never appears before
//! any of its children (like `git log --date-order`). Kahn's algorithm with a max-heap.

use std::cmp::Reverse;
use std::collections::BinaryHeap;

use super::CommitIndex;

/// Returns the commit index shown on each row.
pub fn date_order(index: &CommitIndex) -> Vec<u32> {
    let len = index.len();
    let mut pending_children = vec![0_u32; len];
    for idx in 0..to_u32(len) {
        for &parent in index.parents(idx) {
            pending_children[parent as usize] += 1;
        }
    }
    // Ties on time go to the lower index, i.e. the commit discovered first from the tips.
    let mut ready: BinaryHeap<(i64, Reverse<u32>)> = (0..to_u32(len))
        .filter(|&idx| pending_children[idx as usize] == 0)
        .map(|idx| (index.time(idx), Reverse(idx)))
        .collect();
    let mut rows = Vec::with_capacity(len);
    while let Some((_, Reverse(idx))) = ready.pop() {
        rows.push(idx);
        for &parent in index.parents(idx) {
            let count = &mut pending_children[parent as usize];
            *count -= 1;
            if *count == 0 {
                ready.push((index.time(parent), Reverse(parent)));
            }
        }
    }
    rows
}

/// Inverse of a row order: the row of each commit index.
pub fn rows_of(order: &[u32]) -> Vec<u32> {
    let mut rows = vec![0_u32; order.len()];
    for (row, &idx) in order.iter().enumerate() {
        rows[idx as usize] = to_u32(row);
    }
    rows
}

fn to_u32(value: usize) -> u32 {
    u32::try_from(value).unwrap_or(u32::MAX)
}
