//! Graph data shared with the frontend: summary, row text and reference labels.

use git_core::graph::{CommitRow, GraphRef, RefKind};
use serde::{Deserialize, Serialize};
use specta::Type;

use super::filter_types::GraphFilterDto;

/// Size and shape of a loaded graph.
#[derive(Debug, Clone, PartialEq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct GraphSummary {
    /// Number of rows (commits shown).
    pub rows: u32,
    /// Number of commits without the filter.
    pub total_rows: u32,
    /// What the tab shows.
    pub filter: GraphFilterDto,
    /// Widest lane count.
    pub max_lanes: u32,
    /// Rows per block returned by `get_graph_block`.
    pub block_rows: u32,
    /// Row of the commit HEAD points to.
    pub head_row: Option<u32>,
    /// Parent links dropped because objects are missing (partial clones).
    pub missing_parents: u32,
    /// How long building took, in milliseconds.
    pub build_ms: f64,
    /// Counts the builds of this session's graph; row numbers of different generations do
    /// not match, so the frontend keys its caches by it.
    pub generation: u32,
}

/// The graph after a reload, and where the commit selected before it is now.
#[derive(Debug, Clone, PartialEq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ReloadedGraph {
    /// The new graph.
    pub summary: GraphSummary,
    /// Row of the previously selected commit; `None` when it is gone (amended, rebased) or
    /// nothing was selected.
    pub row: Option<u32>,
}

/// Category of a reference label.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum RefKindDto {
    /// Detached HEAD.
    Head,
    /// Local branch.
    Branch,
    /// Remote-tracking branch.
    Remote,
    /// Tag.
    Tag,
}

impl From<RefKind> for RefKindDto {
    fn from(kind: RefKind) -> Self {
        match kind {
            RefKind::DetachedHead => Self::Head,
            RefKind::LocalBranch => Self::Branch,
            RefKind::RemoteBranch => Self::Remote,
            RefKind::Tag => Self::Tag,
        }
    }
}

/// A reference label on a row.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct RefLabel {
    /// Short name (`main`, `origin/main`, `v1.0`).
    pub name: String,
    /// Category.
    pub kind: RefKindDto,
    /// HEAD points here.
    pub is_head: bool,
}

impl From<&GraphRef> for RefLabel {
    fn from(reference: &GraphRef) -> Self {
        Self {
            name: reference.name.clone(),
            kind: reference.kind.into(),
            is_head: reference.is_head,
        }
    }
}

/// Text columns of one graph row.
#[derive(Debug, Clone, PartialEq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct CommitRowDto {
    /// Row number.
    pub row: u32,
    /// Full commit id.
    pub id: String,
    /// First line of the message.
    pub summary: String,
    /// Author name.
    pub author_name: String,
    /// Author e-mail.
    pub author_email: String,
    /// Author time, seconds since the epoch.
    pub author_time: f64,
    /// Number of parents.
    pub parent_count: u32,
    /// References pointing here.
    pub refs: Vec<RefLabel>,
}

impl From<CommitRow> for CommitRowDto {
    fn from(row: CommitRow) -> Self {
        Self {
            row: row.row,
            id: row.id,
            summary: row.summary,
            author_name: row.author_name,
            author_email: row.author_email,
            // Exact to the second up to the year 287 million: f64 holds 53-bit integers.
            #[allow(clippy::cast_precision_loss)]
            author_time: row.author_time as f64,
            parent_count: row.parent_count,
            refs: row.refs.iter().map(RefLabel::from).collect(),
        }
    }
}
