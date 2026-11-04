//! The compare tab: the files that differ between two revisions (or a revision and the working
//! tree), directly or since their merge base, and the commits each one has that the other lacks.

use git_core::cli::Git;
use git_core::compare::{compare_commits, compare_with_worktree, count_ahead_behind};
use git_core::diff::{ObjectId, parse_object_id};
use git_core::graph::{CommitText, GraphError, commit_text, resolve_commit};
use serde::{Deserialize, Serialize};
use specta::Type;
use tokio_util::sync::CancellationToken;

use super::changes::ChangedFileDto;
use crate::git_env::GitEnvError;
use crate::repository::{RepoId, RepoSessions, RepositoryError, blocking};

/// What to compare: two revisions as typed or picked (a branch, tag, commit id, `HEAD~2`).
#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct CompareRequestDto {
    /// The revision compared from.
    pub base: String,
    /// The revision compared to; ignored when `worktree` is set.
    pub target: String,
    /// Compare from the commits' merge base instead of from `base` (`git diff base...target`):
    /// only what `target` changed since the two split.
    pub since_merge_base: bool,
    /// Compare to the working tree instead of `target` (`git diff base`); the merge base is then
    /// the one of `base` and HEAD.
    pub worktree: bool,
}

/// One of the compared commits.
#[derive(Debug, Clone, PartialEq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ComparedCommitDto {
    /// Full commit id.
    pub id: String,
    /// First line of the message.
    pub summary: String,
    /// Author name.
    pub author_name: String,
    /// Author time in seconds since the epoch.
    pub author_time: f64,
}

/// The files that differ between two revisions.
#[derive(Debug, Clone, PartialEq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ComparisonDto {
    /// The commit `base` names.
    pub base: ComparedCommitDto,
    /// The commit `target` names; HEAD when compared with the working tree.
    pub target: ComparedCommitDto,
    /// The merge base the files are compared from; `null` when compared directly.
    pub merge_base: Option<ComparedCommitDto>,
    /// Sorted by path, at most 100,000. Compared with the working tree, the new side of a file
    /// that is not deleted is the file on disk (no `newId`), except for submodules.
    pub files: Vec<ChangedFileDto>,
    /// All files that differ, including those not listed.
    pub total: u32,
    /// Renames were found only between identical files (a partial clone lacks the contents).
    pub exact_renames_only: bool,
    /// The second side is the working tree.
    pub worktree: bool,
}

/// Commits one side has that the other lacks.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct AheadBehindDto {
    /// Commits of the target that the base lacks.
    pub ahead: u32,
    /// Commits of the base that the target lacks.
    pub behind: u32,
}

impl ComparedCommitDto {
    fn new(id: ObjectId, text: CommitText) -> Self {
        Self {
            id: id.to_string(),
            summary: text.summary,
            author_name: text.author_name,
            // Exact to the second: f64 holds 53-bit integers.
            #[allow(clippy::cast_precision_loss)]
            author_time: text.author_time as f64,
        }
    }
}

fn to_u32(value: impl TryInto<u32>) -> u32 {
    value.try_into().unwrap_or(u32::MAX)
}

/// Compares the two revisions `request` names. A newer comparison cancels one still running.
pub async fn comparison(
    sessions: &RepoSessions,
    id: RepoId,
    request: CompareRequestDto,
) -> Result<ComparisonDto, RepositoryError> {
    let session = sessions.get(id)?;
    let cancel = session.new_comparison();
    let repo = session.repo.clone();
    let CompareRequestDto {
        base,
        target,
        since_merge_base,
        worktree,
    } = request;
    let info = session.repo.info();
    let work_dir = info.work_dir.clone();
    if worktree && work_dir.is_none() {
        return Err(RepositoryError::Bare);
    }
    // The working tree is compared as HEAD for the merge base and the commit counts.
    let target = if worktree { "HEAD".to_owned() } else { target };
    let (base, target) = blocking(move || {
        let local = repo.local();
        let commit = |revision: &str| {
            let id = resolve_commit(&local, revision)?;
            Ok::<_, GraphError>(ComparedCommitDto::new(id, commit_text(&local, id)?))
        };
        Ok::<_, GraphError>((commit(&base)?, commit(&target)?))
    })
    .await??;
    let git = Git::locate().map_err(GitEnvError::from)?;
    let (from, to) = (parse_object_id(&base.id)?, parse_object_id(&target.id)?);
    let repo = session.repo.thread_safe();
    let compared = match &work_dir {
        Some(dir) if worktree => {
            compare_with_worktree(&git, dir, &repo, from, to, since_merge_base, &cancel).await?
        }
        _ => {
            let dir = work_dir.as_ref().unwrap_or(&info.git_dir);
            compare_commits(&git, dir, &repo, from, to, since_merge_base, &cancel).await?
        }
    };
    let merge_base = if since_merge_base {
        let repo = session.repo.clone();
        let from = compared.from;
        let text = blocking(move || commit_text(&repo.local(), from)).await??;
        Some(ComparedCommitDto::new(from, text))
    } else {
        None
    };
    Ok(ComparisonDto {
        base,
        target,
        merge_base,
        files: compared
            .files
            .into_iter()
            .map(ChangedFileDto::from)
            .collect(),
        total: to_u32(compared.total),
        exact_renames_only: compared.exact_renames_only,
        worktree,
    })
}

/// Counts the commits `target` has that `base` lacks and the other way round (both hex ids).
pub async fn ahead_behind(
    sessions: &RepoSessions,
    id: RepoId,
    base: String,
    target: String,
) -> Result<AheadBehindDto, RepositoryError> {
    let session = sessions.get(id)?;
    let (base, target) = (parse_object_id(&base)?, parse_object_id(&target)?);
    let git = Git::locate().map_err(GitEnvError::from)?;
    let info = session.repo.info();
    let dir = info.work_dir.as_ref().unwrap_or(&info.git_dir);
    // A count takes well under a second even on the Linux kernel; nothing cancels it.
    let counts = count_ahead_behind(&git, dir, base, target, &CancellationToken::new()).await?;
    Ok(AheadBehindDto {
        ahead: to_u32(counts.ahead),
        behind: to_u32(counts.behind),
    })
}
