//! The children of a commit: the commits that name it as a parent. Git stores only parents, so
//! they are found from the graph.
//!
//! Rows are in topological order, so every child sits on a row above its parent and one pass
//! from row 0 down to the commit's row finds them all. Like [`Graph::refs_containing`], the cost
//! is the number of rows above the commit: a few milliseconds for the oldest commit of a
//! million-commit history.

use super::Graph;

impl Graph {
    /// Commits that have `commit` as one of their parents, newest row first.
    pub fn children(&self, commit: u32) -> Vec<u32> {
        let Some(&row) = self.rows_of.get(commit as usize) else {
            return Vec::new();
        };
        self.order[..row as usize]
            .iter()
            .copied()
            .filter(|&child| self.index.parents(child).contains(&commit))
            .collect()
    }
}
