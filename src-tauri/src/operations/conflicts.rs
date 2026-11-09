//! The conflicted files, taking a side, and the external merge tool: what the commands take and
//! return, and the service behind them.

use std::time::Duration;

use git_core::operation::{
    ConflictKind, MergeToolOutcome, OperationError, Side, configured_merge_tool, conflicts,
    run_merge_tool, take_side,
};
use serde::{Deserialize, Serialize};
use specta::Type;
use tokio_util::sync::CancellationToken;

use super::error::OperationsError;
use super::service::{git, work_tree};
use crate::repository::{RepoId, RepoSessions, RepositoryError, blocking};
use crate::settings::{ExternalMergeTool, MergeToolKind};

/// A tool that fails (unknown, not installed) does so within this time; one still running then
/// is taken as open.
const START_GRACE: Duration = Duration::from_millis(1500);

/// How a file conflicts.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum ConflictKindDto {
    /// Both sides changed it.
    BothModified,
    /// Both sides added it, differently.
    BothAdded,
    /// Our side deleted it; theirs changed it.
    DeletedByUs,
    /// Their side deleted it; ours changed it.
    DeletedByThem,
    /// Only our side has it.
    AddedByUs,
    /// Only their side has it.
    AddedByThem,
    /// Both sides deleted it.
    BothDeleted,
}

impl From<ConflictKind> for ConflictKindDto {
    fn from(kind: ConflictKind) -> Self {
        match kind {
            ConflictKind::BothModified => Self::BothModified,
            ConflictKind::BothAdded => Self::BothAdded,
            ConflictKind::DeletedByUs => Self::DeletedByUs,
            ConflictKind::DeletedByThem => Self::DeletedByThem,
            ConflictKind::AddedByUs => Self::AddedByUs,
            ConflictKind::AddedByThem => Self::AddedByThem,
            ConflictKind::BothDeleted => Self::BothDeleted,
        }
    }
}

/// A conflicted file.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ConflictDto {
    pub path: String,
    pub kind: ConflictKindDto,
}

/// Which side's version to keep.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum SideDto {
    /// The current branch (during a rebase: the branch rebased onto).
    Ours,
    /// What comes in (the merged branch, the picked or replayed commit).
    Theirs,
}

/// How "Open in merge tool" went.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum MergeToolResultDto {
    /// The tool is open; git stages the file when it is closed with the conflict resolved.
    Opened,
    /// The tool was closed at once and git staged the file.
    Resolved,
    /// The tool was closed at once without resolving the conflict.
    NotResolved,
}

/// The conflicted files of repository `id`, sorted by path.
pub async fn list(
    sessions: &RepoSessions,
    id: RepoId,
) -> Result<Vec<ConflictDto>, OperationsError> {
    let session = sessions.get(id)?;
    let dir = work_tree(&session.repo)?;
    let found = conflicts(&git()?, &dir, &CancellationToken::new()).await?;
    Ok(found
        .into_iter()
        .map(|conflict| ConflictDto {
            path: conflict.path.to_string(),
            kind: conflict.kind.into(),
        })
        .collect())
}

/// Resolves `paths` with `side`'s whole version and stages them.
pub async fn take(
    sessions: &RepoSessions,
    id: RepoId,
    paths: Vec<String>,
    side: SideDto,
) -> Result<(), OperationsError> {
    let session = sessions.get(id)?;
    let dir = work_tree(&session.repo)?;
    let git = git()?;
    let _writing = session.lock_writes().await;
    let side = match side {
        SideDto::Ours => Side::Ours,
        SideDto::Theirs => Side::Theirs,
    };
    Ok(take_side(&git, &dir, &paths, side, &CancellationToken::new()).await?)
}

/// Opens the conflicted `path` in the merge tool `setting` names. Returns once the tool has had
/// a moment to fail; it keeps running without the write lock (the user may take a while), and
/// git stages the file when it is closed resolved, which the file watcher reports.
pub async fn open_merge_tool(
    sessions: &RepoSessions,
    id: RepoId,
    setting: ExternalMergeTool,
    path: String,
) -> Result<MergeToolResultDto, OperationsError> {
    let session = sessions.get(id)?;
    let dir = work_tree(&session.repo)?;
    let git = git()?;
    let tool = match setting.kind {
        MergeToolKind::Git => {
            let repo = session.repo.clone();
            blocking(move || configured_merge_tool(&repo.local()))
                .await?
                .ok_or_else(|| {
                    OperationError::NotApplicable(
                        "No merge tool is set in Git (merge.tool). Choose one in Settings → Diff."
                            .to_owned(),
                    )
                })?
        }
        MergeToolKind::Named if setting.name.trim().is_empty() => {
            return Err(OperationError::NotApplicable(
                "The merge tool's name is empty. Enter it in Settings → Diff.".to_owned(),
            )
            .into());
        }
        MergeToolKind::Named => setting.name.trim().to_owned(),
        preset => preset.git_name().unwrap_or_default().to_owned(),
    };
    let mut running = tokio::spawn(async move {
        run_merge_tool(
            &git,
            &dir,
            &tool,
            path.as_bytes(),
            &CancellationToken::new(),
        )
        .await
    });
    let Ok(finished) = tokio::time::timeout(START_GRACE, &mut running).await else {
        // Still open; how it ends shows in the status, a failure only in the log.
        tokio::spawn(async move {
            match running.await {
                Ok(Err(error)) => tracing::warn!(%error, "the merge tool failed"),
                Ok(Ok(MergeToolOutcome::NotResolved { output })) => {
                    tracing::info!(%output, "the merge tool was closed without resolving");
                }
                _ => {}
            }
        });
        return Ok(MergeToolResultDto::Opened);
    };
    let outcome = finished.map_err(|error| RepositoryError::Task(error.to_string()))??;
    Ok(match outcome {
        MergeToolOutcome::Resolved => MergeToolResultDto::Resolved,
        MergeToolOutcome::NotResolved { .. } => MergeToolResultDto::NotResolved,
    })
}
