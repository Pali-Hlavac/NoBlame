//! The blame tab: who last changed each line of a file at a commit, and where to look for the
//! version before (ADR 0022).

use git_core::blame::{Blame, BlameCommit, BlameHunk, blame};
use git_core::cli::Git;
use git_core::diff::parse_object_id;
use git_core::tree::{TreeEntryKind, entry_at};
use serde::Serialize;
use specta::Type;

use crate::git_env::GitEnvError;
use crate::repository::{RepoId, RepoSessions, RepositoryError, blocking};

/// The version of the file before a commit changed it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct BlamePreviousDto {
    /// The parent commit (hex).
    pub id: String,
    /// The file's path there (it differs after a rename).
    pub path: String,
}

/// A commit some lines come from.
#[derive(Debug, Clone, PartialEq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct BlameCommitDto {
    /// Full commit id.
    pub id: String,
    /// First line of the message.
    pub summary: String,
    /// Author name (after `.mailmap`).
    pub author_name: String,
    /// Author e-mail.
    pub author_email: String,
    /// Author time in seconds since the epoch.
    pub author_time: f64,
    /// What "blame the previous revision" opens; `null` when the commit added the file.
    pub previous: Option<BlamePreviousDto>,
}

/// Consecutive lines from one commit.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct BlameHunkDto {
    /// First line (1-based).
    pub line: u32,
    /// Number of lines.
    pub count: u32,
    /// Index into `commits`.
    pub commit: u32,
    /// First line in that commit's version of the file (1-based).
    pub original_line: u32,
    /// Index into `paths`: the file's path in that commit.
    pub path: u32,
}

/// The blame of a file at a commit.
#[derive(Debug, Clone, PartialEq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct BlameDto {
    /// The file's blob in the commit (hex), for its lines; `null` for a submodule.
    pub blob_id: Option<String>,
    /// Ordered by line, covering every line.
    pub hunks: Vec<BlameHunkDto>,
    /// The commits the hunks name.
    pub commits: Vec<BlameCommitDto>,
    /// The paths the hunks name (lossy for non-UTF-8 bytes).
    pub paths: Vec<String>,
}

fn index(value: usize) -> u32 {
    u32::try_from(value).unwrap_or(u32::MAX)
}

impl From<&BlameHunk> for BlameHunkDto {
    fn from(hunk: &BlameHunk) -> Self {
        Self {
            line: hunk.line,
            count: hunk.count,
            commit: index(hunk.commit),
            original_line: hunk.original_line,
            path: index(hunk.path),
        }
    }
}

impl From<BlameCommit> for BlameCommitDto {
    fn from(commit: BlameCommit) -> Self {
        Self {
            id: commit.id.to_string(),
            summary: commit.summary,
            author_name: commit.author_name,
            author_email: commit.author_email,
            // Exact to the second: f64 holds 53-bit integers.
            #[allow(clippy::cast_precision_loss)]
            author_time: commit.author_time as f64,
            previous: commit.previous.map(|(id, path)| BlamePreviousDto {
                id: id.to_string(),
                path: path.to_string(),
            }),
        }
    }
}

impl BlameDto {
    fn new(blame: Blame, blob_id: Option<String>) -> Self {
        Self {
            blob_id,
            hunks: blame.hunks.iter().map(BlameHunkDto::from).collect(),
            commits: blame
                .commits
                .into_iter()
                .map(BlameCommitDto::from)
                .collect(),
            paths: blame.paths.iter().map(ToString::to_string).collect(),
        }
    }
}

/// Blames `path` as it is in `commit` (hex). A newer blame cancels one still running.
pub async fn file_blame(
    sessions: &RepoSessions,
    id: RepoId,
    commit: String,
    path: String,
) -> Result<BlameDto, RepositoryError> {
    let session = sessions.get(id)?;
    let cancel = session.new_blame();
    let commit = parse_object_id(&commit)?;
    let repo = session.repo.clone();
    let wanted = path.clone();
    let entry = blocking(move || entry_at(&repo.local(), commit, wanted.as_str().into())).await??;
    let blob_id = entry
        .filter(|entry| !matches!(entry.kind, TreeEntryKind::Folder | TreeEntryKind::Submodule))
        .map(|entry| entry.id.to_string());
    let git = Git::locate().map_err(GitEnvError::from)?;
    let info = session.repo.info();
    let dir = info.work_dir.as_ref().unwrap_or(&info.git_dir);
    let found = blame(&git, dir, commit, path.as_str().into(), &cancel).await?;
    Ok(BlameDto::new(found, blob_id))
}
