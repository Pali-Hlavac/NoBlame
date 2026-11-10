//! Bisecting: marking commits from the graph or the bar, and where the bisect stands for the
//! bar. Stopping it is the operation's Abort (`git bisect reset`).

use git_core::cli::Git;
use git_core::operation::{
    BisectCommit, BisectMark, BisectOutcome, bisect_mark as mark_commit, bisect_state,
};
use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::State;
use tokio_util::sync::CancellationToken;

use super::error::OperationsError;
use super::service::{git, work_tree};
use crate::error::CommandResult;
use crate::repository::{RepoId, RepoSessions};

/// How a commit is marked.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum BisectMarkDto {
    /// It does not have the problem.
    Good,
    /// It has the problem.
    Bad,
    /// It cannot be tested.
    Skip,
}

/// Where a bisect stands after a mark.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum BisectOutcomeDto {
    /// It still needs a good commit, a bad one, or both.
    Waiting,
    /// The next commit to test (`commit`, full id) is checked out.
    Testing {
        commit: String,
        remaining: u32,
        steps: u32,
    },
    /// The first bad commit (full id) is found.
    Found { commit: String },
    /// Only skipped commits are left; the first bad one is among them.
    OnlySkipped,
}

/// What a mark did.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct BisectResultDto {
    pub outcome: BisectOutcomeDto,
    /// What git printed.
    pub detail: String,
}

/// A commit named in the bar.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct BisectCommitDto {
    /// Full id.
    pub id: String,
    /// The first line of its message.
    pub summary: String,
}

/// A bisect in progress.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct BisectStateDto {
    /// The commit marked bad.
    pub bad: Option<String>,
    /// The commits marked good.
    pub good: Vec<String>,
    /// The commits skipped.
    pub skipped: Vec<String>,
    /// The commit checked out to test (HEAD), until the first bad one is found.
    pub testing: Option<BisectCommitDto>,
    /// The first bad commit, once found.
    pub first_bad: Option<BisectCommitDto>,
    /// Where stopping returns to (a branch name or a commit).
    pub started_from: Option<String>,
}

impl From<BisectCommit> for BisectCommitDto {
    fn from(commit: BisectCommit) -> Self {
        Self {
            id: commit.id,
            summary: commit.summary,
        }
    }
}

/// Marks `commit` (HEAD when `null`), starting a bisect when none runs.
pub async fn mark(
    sessions: &RepoSessions,
    id: RepoId,
    mark: BisectMarkDto,
    commit: Option<String>,
) -> Result<BisectResultDto, OperationsError> {
    let session = sessions.get(id)?;
    let dir = work_tree(&session.repo)?;
    let git_dir = session.repo.info().git_dir.clone();
    let git = git()?;
    let mark = match mark {
        BisectMarkDto::Good => BisectMark::Good,
        BisectMarkDto::Bad => BisectMark::Bad,
        BisectMarkDto::Skip => BisectMark::Skip,
    };
    let _writing = session.lock_writes().await;
    let cancel = CancellationToken::new();
    let (outcome, detail) =
        mark_commit(&git, &dir, &git_dir, mark, commit.as_deref(), &cancel).await?;
    let outcome = match outcome {
        BisectOutcome::Waiting => BisectOutcomeDto::Waiting,
        BisectOutcome::Testing {
            commit,
            remaining,
            steps,
        } => BisectOutcomeDto::Testing {
            commit,
            remaining,
            steps,
        },
        BisectOutcome::Found { commit } => BisectOutcomeDto::Found { commit },
        BisectOutcome::OnlySkipped => BisectOutcomeDto::OnlySkipped,
    };
    Ok(BisectResultDto { outcome, detail })
}

/// Where the bisect stands; `null` when none runs.
pub async fn state(
    sessions: &RepoSessions,
    id: RepoId,
) -> Result<Option<BisectStateDto>, OperationsError> {
    let session = sessions.get(id)?;
    let dir = work_tree(&session.repo)?;
    let git_dir = session.repo.info().git_dir.clone();
    let git: Git = git()?;
    let Some(state) = bisect_state(&git, &dir, &git_dir, &CancellationToken::new()).await? else {
        return Ok(None);
    };
    Ok(Some(BisectStateDto {
        bad: state.bad,
        good: state.good,
        skipped: state.skipped,
        testing: state.testing.map(Into::into),
        first_bad: state.first_bad.map(Into::into),
        started_from: state.started_from,
    }))
}

/// Marks `commit` (HEAD when `null`) as good, bad or skipped, starting a bisect when none runs;
/// git then checks out the next commit to test, or names the first bad one.
#[tauri::command]
#[specta::specta]
pub async fn bisect_mark(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
    mark: BisectMarkDto,
    commit: Option<String>,
) -> CommandResult<BisectResultDto> {
    Ok(self::mark(&sessions, id, mark, commit).await?)
}

/// Where the bisect stands (marks, the commit tested, the first bad one);
/// `null` when none runs.
#[tauri::command]
#[specta::specta]
pub async fn get_bisect(
    sessions: State<'_, RepoSessions>,
    id: RepoId,
) -> CommandResult<Option<BisectStateDto>> {
    Ok(state(&sessions, id).await?)
}
