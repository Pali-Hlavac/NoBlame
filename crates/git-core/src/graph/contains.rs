//! Which references contain a commit (`git branch --contains` / `git tag --contains`), answered
//! from the graph instead of walking objects.
//!
//! Rows are in topological order: every commit's parents sit on later rows. So one pass from the
//! commit's row up to row 0 marks every commit that reaches it, and a reference contains the
//! commit when its tip is marked. The cost is the number of rows above the commit, a few
//! milliseconds for the oldest commit of a million-commit history.

use super::{Graph, GraphRef};

impl Graph {
    /// References whose history includes `commit` (including those pointing at it), sorted by
    /// kind and name.
    pub fn refs_containing(&self, commit: u32) -> Vec<&GraphRef> {
        let Some(&row) = self.rows_of.get(commit as usize) else {
            return Vec::new();
        };
        // reaches[r] is true when the commit on row r has `commit` in its history.
        let mut reaches = vec![false; row as usize + 1];
        reaches[row as usize] = true;
        for current in (0..row).rev() {
            let child = self.order[current as usize];
            reaches[current as usize] = self.index.parents(child).iter().any(|&parent| {
                let parent_row = self.rows_of[parent as usize];
                parent_row <= row && reaches[parent_row as usize]
            });
        }
        let mut refs: Vec<&GraphRef> = self
            .refs_by_commit
            .iter()
            .filter(|&(&tip, _)| {
                let tip_row = self.rows_of[tip as usize];
                tip_row <= row && reaches[tip_row as usize]
            })
            .flat_map(|(_, numbers)| numbers.iter().map(|&number| &self.refs[number as usize]))
            .collect();
        refs.sort_by(|a, b| (a.kind, &a.name).cmp(&(b.kind, &b.name)));
        refs
    }

    /// Every reference with the row of the commit it points to (`None` when the target is not a
    /// commit in the graph, for example a tag of a tree), sorted by kind and name.
    pub fn refs_with_rows(&self) -> Vec<(&GraphRef, Option<u32>)> {
        let mut rows = vec![None; self.refs.len()];
        for (&commit, numbers) in &self.refs_by_commit {
            for &number in numbers {
                rows[number as usize] = Some(self.rows_of[commit as usize]);
            }
        }
        let mut refs: Vec<_> = self.refs.iter().zip(rows).collect();
        refs.sort_by(|(a, _), (b, _)| (a.kind, &a.name).cmp(&(b.kind, &b.name)));
        refs
    }
}
