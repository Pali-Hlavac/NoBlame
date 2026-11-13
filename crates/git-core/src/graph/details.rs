//! Text columns for visible rows: id, summary and body, author, date and ref labels. Read
//! lazily, one page at a time, because decoding a million commit objects up front would be far
//! too slow.

use gix::ObjectId;

use super::{Graph, GraphError, GraphRef};

/// Largest page [`commit_rows`] returns; the UI asks for a screenful plus some margin.
pub const MAX_ROWS_PER_PAGE: u32 = 500;

/// Longest body a row carries, in characters: more than a row can show.
pub const MAX_BODY_CHARS: usize = 300;

/// Columns of one graph row.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CommitRow {
    /// Row number.
    pub row: u32,
    /// Full hex object id.
    pub id: String,
    /// First line of the message (lossy if not UTF-8).
    pub summary: String,
    /// The rest of the message on one line: whitespace runs as one space, at most
    /// [`MAX_BODY_CHARS`] characters; empty without one.
    pub body: String,
    /// Author name (lossy if not UTF-8).
    pub author_name: String,
    /// Author e-mail (lossy if not UTF-8).
    pub author_email: String,
    /// Author time, seconds since the epoch.
    pub author_time: i64,
    /// Number of parents (more than one: merge).
    pub parent_count: u32,
    /// References pointing at the commit.
    pub refs: Vec<GraphRef>,
}

/// Reads rows `start..start + count` (clamped to the graph and to [`MAX_ROWS_PER_PAGE`]).
pub fn commit_rows(
    repo: &gix::Repository,
    graph: &Graph,
    start: u32,
    count: u32,
) -> Result<Vec<CommitRow>, GraphError> {
    let rows = graph.row_count();
    if start > rows {
        return Err(GraphError::RowOutOfRange { row: start, rows });
    }
    let end = start.saturating_add(count.min(MAX_ROWS_PER_PAGE)).min(rows);
    (start..end)
        .map(|row| {
            let commit = graph
                .commit_at(row)
                .ok_or(GraphError::RowOutOfRange { row, rows })?;
            read_row(repo, graph, row, commit)
        })
        .collect()
}

fn read_row(
    repo: &gix::Repository,
    graph: &Graph,
    row: u32,
    commit: u32,
) -> Result<CommitRow, GraphError> {
    let index = graph.index();
    let id = *index.id(commit);
    let object = repo.find_commit(id).map_err(GraphError::gix)?;
    let author = object.author().map_err(GraphError::gix)?.trim();
    let message = object.message().map_err(GraphError::gix)?;
    let summary = message.summary().to_string();
    let body = message.body.map(one_line).unwrap_or_default();
    let mut refs: Vec<GraphRef> = graph.refs_of(commit).cloned().collect();
    refs.sort_by(|a, b| (a.kind, &a.name).cmp(&(b.kind, &b.name)));
    Ok(CommitRow {
        row,
        id: id.to_string(),
        summary,
        body,
        author_name: author.name.to_string(),
        author_email: author.email.to_string(),
        author_time: author.seconds(),
        parent_count: u32::try_from(graph.parent_count(commit)).unwrap_or(u32::MAX),
        refs,
    })
}

/// `text` on one line (lossy if not UTF-8): runs of whitespace, line breaks too, become one
/// space, cut after [`MAX_BODY_CHARS`] characters.
fn one_line(text: &gix::bstr::BStr) -> String {
    let text = text.to_string();
    let mut line = String::new();
    for word in text.split_whitespace() {
        if !line.is_empty() {
            line.push(' ');
        }
        line.push_str(word);
        if line.chars().count() >= MAX_BODY_CHARS {
            break;
        }
    }
    line.chars().take(MAX_BODY_CHARS).collect()
}

/// Summary and author of one commit, for lists that are not graph rows (a file's history).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CommitText {
    /// First line of the message (lossy if not UTF-8).
    pub summary: String,
    /// Author name (lossy if not UTF-8).
    pub author_name: String,
    /// Author e-mail (lossy if not UTF-8).
    pub author_email: String,
    /// Author time, seconds since the epoch.
    pub author_time: i64,
}

/// Reads the summary and author of commit `id`.
pub fn commit_text(repo: &gix::Repository, id: ObjectId) -> Result<CommitText, GraphError> {
    let object = repo.find_commit(id).map_err(GraphError::gix)?;
    let author = object.author().map_err(GraphError::gix)?.trim();
    let summary = object.message().map_err(GraphError::gix)?.summary();
    Ok(CommitText {
        summary: summary.to_string(),
        author_name: author.name.to_string(),
        author_email: author.email.to_string(),
        author_time: author.seconds(),
    })
}
