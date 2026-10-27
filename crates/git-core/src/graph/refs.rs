//! References shown in the graph: local and remote branches, tags and a detached HEAD.
//! They are also the tips the history walk starts from.

use gix::ObjectId;
use gix::refs::Category;

use super::GraphError;

/// What a reference label stands for.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum RefKind {
    /// HEAD when it is detached (not on a branch).
    DetachedHead,
    /// `refs/heads/*`
    LocalBranch,
    /// `refs/remotes/*`
    RemoteBranch,
    /// `refs/tags/*`
    Tag,
}

/// One reference label.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GraphRef {
    /// Short name for display (`main`, `origin/main`, `v1.0`); lossy if not UTF-8.
    pub name: String,
    /// Category of the reference.
    pub kind: RefKind,
    /// The commit it points to (annotated tags are peeled).
    pub target: ObjectId,
    /// Whether HEAD points at this branch (or this is the detached HEAD label).
    pub is_head: bool,
}

/// Reads every branch, remote branch and tag, plus HEAD when it is detached. Symbolic remote
/// refs (`origin/HEAD`) are skipped; other namespaces (notes, stash, replace) are ignored.
pub fn collect_refs(repo: &gix::Repository) -> Result<Vec<GraphRef>, GraphError> {
    let head = repo.head().map_err(GraphError::gix)?;
    let head_branch = head.referent_name().map(|name| name.as_bstr().to_owned());
    let mut refs = Vec::new();
    if head_branch.is_none()
        && let Some(id) = head.id()
    {
        refs.push(GraphRef {
            name: "HEAD".to_owned(),
            kind: RefKind::DetachedHead,
            target: id.detach(),
            is_head: true,
        });
    }

    let platform = repo.references().map_err(GraphError::gix)?;
    for reference in platform.all().map_err(GraphError::gix)? {
        let mut reference = reference.map_err(GraphError::gix)?;
        let kind = match reference.name().category() {
            Some(Category::LocalBranch) => RefKind::LocalBranch,
            Some(Category::RemoteBranch) => RefKind::RemoteBranch,
            Some(Category::Tag) => RefKind::Tag,
            _ => continue,
        };
        if kind == RefKind::RemoteBranch && reference.target().try_id().is_none() {
            continue;
        }
        let full_name = reference.name().as_bstr().to_owned();
        let name = reference.name().shorten().to_string();
        // A dangling ref is skipped rather than failing the whole graph.
        let Ok(target) = reference.peel_to_id() else {
            tracing::warn!(%name, "skipping a reference that cannot be resolved");
            continue;
        };
        refs.push(GraphRef {
            name,
            kind,
            target: target.detach(),
            is_head: head_branch.as_ref() == Some(&full_name),
        });
    }
    Ok(refs)
}
