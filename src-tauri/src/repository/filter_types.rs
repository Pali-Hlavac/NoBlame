//! The filter of a repository tab, as the frontend sends and receives it.

use git_core::graph::{GraphFilter, RefKind, RefSelector, TextFilter, Tips};
use serde::{Deserialize, Serialize};
use specta::Type;

use super::graph_types::RefKindDto;

/// One reference, by kind and short name.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct RefSelectorDto {
    /// Branch, remote branch or tag.
    pub kind: RefKindDto,
    /// Short name (`main`, `origin/main`, `v1.0`).
    pub name: String,
}

/// Whose history the tab shows.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum TipsDto {
    /// Every branch, remote branch and tag.
    All,
    /// The commit HEAD points to (the current branch).
    Head,
    /// The given references.
    Refs {
        /// The references.
        refs: Vec<RefSelectorDto>,
    },
}

/// What a repository tab shows.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct GraphFilterDto {
    /// Whose history.
    pub tips: TipsDto,
    /// Follow first parents only.
    pub first_parent: bool,
    /// Leave merges out.
    pub no_merges: bool,
    /// Part of the author's name or e-mail, ignoring case; `null` or blank for any author.
    pub author: Option<String>,
    /// Part of the message, ignoring case; `null` or blank for any message.
    pub message: Option<String>,
}

impl From<GraphFilterDto> for GraphFilter {
    fn from(filter: GraphFilterDto) -> Self {
        Self {
            tips: match filter.tips {
                TipsDto::All => Tips::All,
                TipsDto::Head => Tips::Head,
                TipsDto::Refs { refs } => Tips::Refs(
                    refs.into_iter()
                        .map(|selector| RefSelector {
                            kind: ref_kind(selector.kind),
                            name: selector.name,
                        })
                        .collect(),
                ),
            },
            first_parent: filter.first_parent,
            no_merges: filter.no_merges,
            text: TextFilter {
                author: filter.author.filter(|text| !text.trim().is_empty()),
                message: filter.message.filter(|text| !text.trim().is_empty()),
            },
        }
    }
}

impl From<&GraphFilter> for GraphFilterDto {
    fn from(filter: &GraphFilter) -> Self {
        Self {
            tips: match &filter.tips {
                Tips::All => TipsDto::All,
                Tips::Head => TipsDto::Head,
                Tips::Refs(refs) => TipsDto::Refs {
                    refs: refs
                        .iter()
                        .map(|selector| RefSelectorDto {
                            kind: selector.kind.into(),
                            name: selector.name.clone(),
                        })
                        .collect(),
                },
            },
            first_parent: filter.first_parent,
            no_merges: filter.no_merges,
            author: filter.text.author.clone(),
            message: filter.text.message.clone(),
        }
    }
}

fn ref_kind(kind: RefKindDto) -> RefKind {
    match kind {
        RefKindDto::Head => RefKind::DetachedHead,
        RefKindDto::Branch => RefKind::LocalBranch,
        RefKindDto::Remote => RefKind::RemoteBranch,
        RefKindDto::Tag => RefKind::Tag,
    }
}
