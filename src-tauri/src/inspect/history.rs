//! The history tab: the commits that change a file or folder, following renames, read page by
//! page with their summary and author.

use git_core::graph::commit_text;
use git_core::history::{HistoryStop, PathChange};
use serde::Serialize;
use specta::Type;

use crate::repository::{RepoId, RepoSessions, RepositoryError, blocking};

/// Most rows one request may ask for.
const MAX_HISTORY_PAGE_ROWS: u32 = 500;

/// What a commit did to the path.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum PathChangeDto {
    /// Created it.
    Added,
    /// Changed it.
    Modified,
    /// Removed it.
    Deleted,
    /// Renamed the file to this path (`previousPath` is the old name).
    Renamed,
    /// A merge that differs from every parent at the path.
    Merge,
}

/// Why the history ends before the file's first commit.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase", tag = "kind")]
pub enum HistoryStopDto {
    /// 64 renames were followed.
    TooManyRenames,
    /// Following a rename needs file contents a partial clone does not have.
    MissingContents {
        /// The commit (hex) where following stopped.
        commit: String,
    },
}

/// A path's history: how many commits, its earlier names, and whether it is complete.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct FileHistoryDto {
    /// Commits in the history.
    pub total: u32,
    /// The names the file had before, as found (lossy for non-UTF-8 bytes).
    pub previous_names: Vec<String>,
    /// Set when renames were not followed to the file's first commit.
    pub stopped: Option<HistoryStopDto>,
}

/// One commit of a history.
#[derive(Debug, Clone, PartialEq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct FileHistoryRowDto {
    /// Full commit id (hex).
    pub id: String,
    /// Its row in the graph the tab shows; `null` when the filter hides it.
    pub row: Option<u32>,
    /// The file's path in this commit.
    pub path: String,
    /// What the commit did to it.
    pub change: PathChangeDto,
    /// For a rename, the name before.
    pub previous_path: Option<String>,
    /// First line of the message.
    pub summary: String,
    /// Author name.
    pub author_name: String,
    /// Author e-mail.
    pub author_email: String,
    /// Author time in seconds since the epoch.
    pub author_time: f64,
}

impl From<PathChange> for PathChangeDto {
    fn from(change: PathChange) -> Self {
        match change {
            PathChange::Added => Self::Added,
            PathChange::Modified => Self::Modified,
            PathChange::Deleted => Self::Deleted,
            PathChange::Renamed => Self::Renamed,
            PathChange::Merge => Self::Merge,
        }
    }
}

/// The history of `path` on the branches the tab's filter shows, following renames.
pub async fn file_history(
    sessions: &RepoSessions,
    id: RepoId,
    path: String,
) -> Result<FileHistoryDto, RepositoryError> {
    let found = sessions.get(id)?.path_history(&path).await?;
    let history = &found.history;
    Ok(FileHistoryDto {
        total: u32::try_from(history.entries.len()).unwrap_or(u32::MAX),
        previous_names: history.paths[1..].iter().map(ToString::to_string).collect(),
        stopped: history.stopped.as_ref().map(|stop| match stop {
            HistoryStop::TooManyRenames => HistoryStopDto::TooManyRenames,
            HistoryStop::MissingContents(commit) => HistoryStopDto::MissingContents {
                commit: commit.to_string(),
            },
        }),
    })
}

/// Up to `count` commits (at most 500) of that history from position `start`, with their rows
/// in the graph the tab shows now.
pub async fn file_history_rows(
    sessions: &RepoSessions,
    id: RepoId,
    path: String,
    start: u32,
    count: u32,
) -> Result<Vec<FileHistoryRowDto>, RepositoryError> {
    let session = sessions.get(id)?;
    let found = session.path_history(&path).await?;
    let shown = session.graph(false).await?;
    let repo = session.repo.clone();
    let rows = blocking(move || {
        let repo = repo.local();
        let history = &found.history;
        let start = (start as usize).min(history.entries.len());
        let end = start
            .saturating_add(count.min(MAX_HISTORY_PAGE_ROWS) as usize)
            .min(history.entries.len());
        history.entries[start..end]
            .iter()
            .map(|entry| {
                let text = commit_text(&repo, entry.id)?;
                Ok(FileHistoryRowDto {
                    id: entry.id.to_string(),
                    row: shown.lookup_row(&entry.id),
                    path: history.paths[entry.path].to_string(),
                    change: entry.change.into(),
                    previous_path: entry.previous.map(|name| history.paths[name].to_string()),
                    summary: text.summary,
                    author_name: text.author_name,
                    author_email: text.author_email,
                    // Exact to the second: f64 holds 53-bit integers.
                    // Exact to the second: f64 holds 53-bit integers.
                    // Exact to the second: f64 holds 53-bit integers.
                    #[allow(clippy::cast_precision_loss)]
                    author_time: text.author_time as f64,
                })
            })
            .collect::<Result<Vec<_>, RepositoryError>>()
    })
    .await??;
    Ok(rows)
}
