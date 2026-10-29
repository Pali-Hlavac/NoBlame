//! Which commits a repository tab shows: the history of some references, first parents only,
//! without merges (answered from the graph in one pass over the rows), and by author or message
//! (read from the commit objects, see `text.rs`).

use std::sync::Arc;

use tokio_util::sync::CancellationToken;

use super::text::keep_matching;
use super::view::followed;
use super::{Graph, GraphError, GraphRef, RefKind, TextFilter};

/// Whose history a filter shows.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub enum Tips {
    /// Every branch, remote branch and tag, and HEAD.
    #[default]
    All,
    /// The commit HEAD points to.
    Head,
    /// The given references.
    Refs(Vec<RefSelector>),
}

/// One reference, by kind and short name (`main`, `origin/main`, `v1.0`).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RefSelector {
    /// Branch, remote branch or tag.
    pub kind: RefKind,
    /// Short name, as in [`GraphRef::name`].
    pub name: String,
}

impl RefSelector {
    fn matches(&self, reference: &GraphRef) -> bool {
        reference.kind == self.kind && reference.name == self.name
    }
}

/// What a repository tab shows. The default shows everything.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct GraphFilter {
    /// Whose history.
    pub tips: Tips,
    /// Follow first parents only (`git log --first-parent`).
    pub first_parent: bool,
    /// Leave merges out (`git log --no-merges`).
    pub no_merges: bool,
    /// Author and message.
    pub text: TextFilter,
}

impl GraphFilter {
    /// Whether the filter shows every commit.
    pub fn is_empty(&self) -> bool {
        self.tips == Tips::All && !self.first_parent && !self.no_merges && self.text.is_empty()
    }
}

impl Graph {
    /// The commits `filter` keeps, by commit index of this full graph. A reference that no
    /// longer exists contributes nothing.
    pub fn shown_by(&self, filter: &GraphFilter) -> Vec<bool> {
        let len = self.index.len();
        let mut shown = match &filter.tips {
            Tips::All if !filter.first_parent => vec![true; len],
            Tips::All => {
                let tips: Vec<u32> = self.refs_by_commit.keys().copied().collect();
                self.reachable(
                    tips.into_iter().chain(self.head_commit),
                    filter.first_parent,
                )
            }
            Tips::Head => self.reachable(self.head_commit, filter.first_parent),
            Tips::Refs(selectors) => {
                let tips: Vec<u32> = self
                    .refs_by_commit
                    .iter()
                    .filter(|(_, numbers)| {
                        numbers.iter().any(|&number| {
                            let reference = &self.refs[number as usize];
                            selectors.iter().any(|selector| selector.matches(reference))
                        })
                    })
                    .map(|(&commit, _)| commit)
                    .collect();
                self.reachable(tips, filter.first_parent)
            }
        };
        if filter.no_merges {
            for (commit, shown) in shown.iter_mut().enumerate() {
                *shown &= self.index.parents(to_u32(commit)).len() <= 1;
            }
        }
        shown
    }

    /// A view of this full graph showing what `filter` keeps, without reading objects: the text
    /// filter is ignored.
    pub fn filtered(self: &Arc<Self>, filter: &GraphFilter) -> Graph {
        self.view(&self.shown_by(filter), filter.first_parent)
    }

    /// A view of this full graph showing what `filter` keeps, reading the commit objects of
    /// `repo` for the text filter. Stops with [`GraphError::Cancelled`] once `cancel` is.
    pub fn filtered_in(
        self: &Arc<Self>,
        repo: &gix::ThreadSafeRepository,
        filter: &GraphFilter,
        cancel: &CancellationToken,
    ) -> Result<Graph, GraphError> {
        let mut shown = self.shown_by(filter);
        keep_matching(repo, &self.index, &mut shown, &filter.text, cancel)?;
        if cancel.is_cancelled() {
            return Err(GraphError::Cancelled);
        }
        Ok(self.view(&shown, filter.first_parent))
    }

    /// Commits reachable from `tips`. Parents sit on later rows, so one pass down the rows
    /// carries the marks to every ancestor.
    fn reachable(&self, tips: impl IntoIterator<Item = u32>, first_parent: bool) -> Vec<bool> {
        let mut reached = vec![false; self.index.len()];
        for tip in tips {
            reached[tip as usize] = true;
        }
        for &commit in &self.order {
            if reached[commit as usize] {
                for &parent in followed(self.index.parents(commit), first_parent) {
                    reached[parent as usize] = true;
                }
            }
        }
        reached
    }
}

fn to_u32(value: usize) -> u32 {
    u32::try_from(value).unwrap_or(u32::MAX)
}
