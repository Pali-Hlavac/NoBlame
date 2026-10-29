//! Filtered views of a graph: only some commits, each joined to its nearest shown ancestors
//! (what git calls parent rewriting), with its own rows and lane layout.
//!
//! A view keeps the row order of the full graph, which is already topological and by date, so
//! nothing is sorted again. Hidden commits are resolved from the oldest row up: each stands for
//! the nearest shown commits below it, so a shown commit's parents are found by looking at its
//! real parents once. Only the lane layout is computed afresh.
//!
//! In a view, commit `i` is the commit on row `i`.

use std::collections::HashMap;
use std::sync::Arc;
use std::time::Instant;

use super::{BuildTimings, CommitIndex, Graph, Layout};

/// A hidden merge whose sides lead to more shown commits than this keeps the first ones only:
/// more lines than this into one node cannot be told apart anyway.
const MAX_REWRITTEN_PARENTS: usize = 32;

/// No shown commit below (a hidden root).
const NONE: u32 = u32::MAX;
/// Several shown commits below; listed in [`Nearest::many`].
const MANY: u32 = u32::MAX - 1;

/// Where the rows of a view come from.
#[derive(Debug)]
pub(super) struct ViewSource {
    /// The unfiltered graph.
    full: Arc<Graph>,
    /// The row in `full` of each row of the view, ascending.
    full_rows: Vec<u32>,
}

/// The nearest shown commits (view indices) of every commit of the full graph.
struct Nearest {
    /// The one nearest commit, [`NONE`] or [`MANY`].
    single: Vec<u32>,
    many: HashMap<u32, Vec<u32>>,
}

impl Nearest {
    fn extend_into(&self, commit: u32, targets: &mut Vec<u32>) {
        match self.single[commit as usize] {
            NONE => {}
            MANY => {
                for &target in self.many.get(&commit).into_iter().flatten() {
                    push_unique(targets, target);
                }
            }
            target => push_unique(targets, target),
        }
    }

    fn set(&mut self, commit: u32, targets: &[u32]) {
        match targets {
            [] => {}
            [target] => self.single[commit as usize] = *target,
            _ => {
                self.single[commit as usize] = MANY;
                self.many.insert(commit, targets.to_vec());
            }
        }
    }
}

fn push_unique(targets: &mut Vec<u32>, target: u32) {
    if targets.len() < MAX_REWRITTEN_PARENTS && !targets.contains(&target) {
        targets.push(target);
    }
}

/// The parents a view follows: only the first one in first-parent mode.
pub(super) fn followed(parents: &[u32], first_parent: bool) -> &[u32] {
    if first_parent {
        &parents[..parents.len().min(1)]
    } else {
        parents
    }
}

impl Graph {
    /// A view of this full graph showing the commits marked in `shown` (by commit index). With
    /// `first_parent`, only first-parent lines are followed and drawn.
    pub fn view(self: &Arc<Self>, shown: &[bool], first_parent: bool) -> Graph {
        debug_assert!(self.source.is_none(), "views are made from the full graph");
        let started = Instant::now();
        let mut new_of = vec![NONE; self.index.len()];
        let mut full_rows = Vec::new();
        for (row, &commit) in self.order.iter().enumerate() {
            if shown.get(commit as usize).copied().unwrap_or(false) {
                new_of[commit as usize] = to_u32(full_rows.len());
                full_rows.push(to_u32(row));
            }
        }

        let mut nearest = Nearest {
            single: vec![NONE; self.index.len()],
            many: HashMap::new(),
        };
        let mut spans = vec![(0_u32, 0_u32); full_rows.len()];
        let mut lists = Vec::with_capacity(full_rows.len());
        let mut targets = Vec::new();
        // Parents sit on later rows, so they are resolved before their children.
        for &commit in self.order.iter().rev() {
            targets.clear();
            for &parent in followed(self.index.parents(commit), first_parent) {
                nearest.extend_into(parent, &mut targets);
            }
            match new_of[commit as usize] {
                NONE => nearest.set(commit, &targets),
                new => {
                    spans[new as usize] = (to_u32(lists.len()), to_u32(targets.len()));
                    lists.extend_from_slice(&targets);
                    nearest.single[commit as usize] = new;
                }
            }
        }

        let mut parent_start = Vec::with_capacity(full_rows.len() + 1);
        let mut parents = Vec::with_capacity(lists.len());
        for &(start, len) in &spans {
            parent_start.push(to_u32(parents.len()));
            parents.extend_from_slice(&lists[start as usize..(start + len) as usize]);
        }
        parent_start.push(to_u32(parents.len()));
        let commits = full_rows.iter().map(|&row| self.order[row as usize]);
        let index = CommitIndex::from_parts(
            commits
                .clone()
                .map(|commit| *self.index.id(commit))
                .collect(),
            commits.map(|commit| self.index.time(commit)).collect(),
            parent_start,
            parents,
            self.index.missing_parents,
        );
        let order: Vec<u32> = (0..to_u32(full_rows.len())).collect();
        let layout = Layout::compute(&index, &order);
        let refs_by_commit = self
            .refs_by_commit
            .iter()
            .filter(|&(&commit, _)| new_of[commit as usize] != NONE)
            .map(|(&commit, numbers)| (new_of[commit as usize], numbers.clone()))
            .collect();
        let head_commit = self
            .head_commit
            .map(|commit| new_of[commit as usize])
            .filter(|&new| new != NONE);
        Graph {
            index,
            rows_of: order.clone(),
            order,
            layout,
            refs: self.refs.clone(),
            refs_by_commit,
            head_commit,
            timings: BuildTimings {
                filter: started.elapsed(),
                ..self.timings
            },
            source: Some(ViewSource {
                full: Arc::clone(self),
                full_rows,
            }),
        }
    }

    /// The unfiltered graph: the one this view was made from, or itself.
    pub fn full(&self) -> &Graph {
        self.source.as_ref().map_or(self, |source| &source.full)
    }

    /// Whether this is a filtered view.
    pub fn is_filtered(&self) -> bool {
        self.source.is_some()
    }

    /// The row in [`full`](Self::full) of `row`.
    pub fn full_row(&self, row: u32) -> Option<u32> {
        match &self.source {
            Some(source) => source.full_rows.get(row as usize).copied(),
            None => (row < self.row_count()).then_some(row),
        }
    }

    /// The row showing the commit on row `full_row` of [`full`](Self::full), if it is shown.
    pub fn shown_row(&self, full_row: u32) -> Option<u32> {
        match &self.source {
            Some(source) => source.full_rows.binary_search(&full_row).ok().map(to_u32),
            None => (full_row < self.row_count()).then_some(full_row),
        }
    }

    /// The number of parents `commit` really has (a view may join it to fewer or more).
    pub(super) fn parent_count(&self, commit: u32) -> usize {
        let full = self.full();
        self.full_row(self.rows_of[commit as usize])
            .and_then(|row| full.commit_at(row))
            .map_or(0, |commit| full.index.parents(commit).len())
    }
}

fn to_u32(value: usize) -> u32 {
    u32::try_from(value).unwrap_or(u32::MAX)
}
