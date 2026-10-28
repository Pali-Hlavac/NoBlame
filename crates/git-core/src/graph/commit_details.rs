//! Everything the Commit details module shows about one row: full message, author and
//! committer, parents, the refs pointing at it and the refs containing it.

use super::{Graph, GraphError, GraphRef};

/// How many containing refs are returned at most; the total is reported separately, because
/// an old commit of a big repository is contained in thousands of branches and tags.
pub const MAX_CONTAINING_REFS: usize = 500;

/// A person and a moment (author or committer).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Signature {
    /// Name (lossy if not UTF-8).
    pub name: String,
    /// E-mail (lossy if not UTF-8).
    pub email: String,
    /// Seconds since the epoch.
    pub time: i64,
    /// Time-zone offset of the signature, in seconds east of UTC.
    pub offset_seconds: i32,
}

/// One parent of the commit.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParentInfo {
    /// Full hex object id.
    pub id: String,
    /// Its row in the graph.
    pub row: u32,
}

/// Details of one commit.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CommitDetails {
    /// Row number.
    pub row: u32,
    /// Full hex object id.
    pub id: String,
    /// Parents in order (first parent first).
    pub parents: Vec<ParentInfo>,
    /// Who wrote the change.
    pub author: Signature,
    /// Who created the commit.
    pub committer: Signature,
    /// The whole message (lossy if not UTF-8).
    pub message: String,
    /// References pointing at the commit.
    pub refs: Vec<GraphRef>,
    /// Up to [`MAX_CONTAINING_REFS`] references whose history includes the commit.
    pub contained_in: Vec<GraphRef>,
    /// How many references contain the commit in total.
    pub contained_in_total: u32,
}

/// Reads the details of the commit on `row`.
pub fn commit_details(
    repo: &gix::Repository,
    graph: &Graph,
    row: u32,
) -> Result<CommitDetails, GraphError> {
    let rows = graph.row_count();
    let commit = graph
        .commit_at(row)
        .ok_or(GraphError::RowOutOfRange { row, rows })?;
    let index = graph.index();
    let id = *index.id(commit);
    let object = repo.find_commit(id).map_err(GraphError::gix)?;
    let message = object.message_raw().map_err(GraphError::gix)?.to_string();
    let author = signature(object.author().map_err(GraphError::gix)?);
    let committer = signature(object.committer().map_err(GraphError::gix)?);

    let parents = index
        .parents(commit)
        .iter()
        .map(|&parent| ParentInfo {
            id: index.id(parent).to_string(),
            row: graph.rows_of[parent as usize],
        })
        .collect();
    let mut refs: Vec<GraphRef> = graph.refs_of(commit).cloned().collect();
    refs.sort_by(|a, b| (a.kind, &a.name).cmp(&(b.kind, &b.name)));
    let containing = graph.refs_containing(commit);
    Ok(CommitDetails {
        row,
        id: id.to_string(),
        parents,
        author,
        committer,
        message,
        refs,
        contained_in_total: u32::try_from(containing.len()).unwrap_or(u32::MAX),
        contained_in: containing
            .into_iter()
            .take(MAX_CONTAINING_REFS)
            .cloned()
            .collect(),
    })
}

fn signature(signature: gix::actor::SignatureRef<'_>) -> Signature {
    let signature = signature.trim();
    Signature {
        name: signature.name.to_string(),
        email: signature.email.to_string(),
        time: signature.seconds(),
        offset_seconds: signature.time().map_or(0, |time| time.offset),
    }
}
