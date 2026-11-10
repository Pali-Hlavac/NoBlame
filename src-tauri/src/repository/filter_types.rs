//! The filter of a repository tab, as the frontend sends and receives it.

use git_core::graph::{GraphFilter, RefKind, RefSelector, TextFilter, Tips};
use std::path::Path;

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
    /// Only commits changing this file or folder, relative to the top of the working tree (a
    /// git pathspec, so `*.rs` works); `null` or blank for any.
    pub path: Option<String>,
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
            path: filter.path.and_then(|path| pathspec(&path)),
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
            path: filter.path.clone(),
        }
    }
}

/// `path` as git expects it: forward slashes, no leading `./` or `/`; `None` when blank.
fn pathspec(path: &str) -> Option<String> {
    let path = path.trim().replace('\\', "/");
    let path = path.trim_start_matches("./").trim_start_matches('/');
    (!path.is_empty()).then(|| path.to_owned())
}

/// `path` relative to `root` when it is an absolute path inside it (pasted from a file
/// manager); otherwise unchanged.
pub fn relative_to(root: Option<&Path>, path: String) -> String {
    match root.and_then(|root| Path::new(&path).strip_prefix(root).ok()) {
        Some(relative) => relative.to_string_lossy().into_owned(),
        None => path,
    }
}

fn ref_kind(kind: RefKindDto) -> RefKind {
    match kind {
        RefKindDto::Head => RefKind::DetachedHead,
        RefKindDto::Branch => RefKind::LocalBranch,
        RefKindDto::Remote => RefKind::RemoteBranch,
        RefKindDto::Tag => RefKind::Tag,
        RefKindDto::Bisect => RefKind::Bisect,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn paths_become_git_pathspecs() {
        assert_eq!(pathspec(r" .\src\lib.rs "), Some("src/lib.rs".to_owned()));
        assert_eq!(pathspec("/docs/"), Some("docs/".to_owned()));
        assert_eq!(pathspec("*.rs"), Some("*.rs".to_owned()));
        assert_eq!(pathspec("  "), None);
    }

    #[test]
    fn absolute_paths_inside_the_repository_become_relative() {
        let root = std::env::temp_dir().join("repo");
        let inside = root.join("src").join("lib.rs");
        let inside = inside.to_string_lossy().into_owned();
        assert_eq!(
            pathspec(&relative_to(Some(&root), inside)),
            Some("src/lib.rs".to_owned())
        );
        assert_eq!(relative_to(Some(&root), "src".to_owned()), "src");
        assert_eq!(relative_to(None, "src".to_owned()), "src");
    }
}
