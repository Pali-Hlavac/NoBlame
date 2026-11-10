//! The reflog of HEAD or a local branch, for the Reflog module: what the command returns and the
//! service behind it.

use git_core::reflog::{reflog, reflog_references};
use serde::Serialize;
use specta::Type;

use super::error::OperationsError;
use crate::repository::{RepoId, RepoSessions, blocking};

/// One change of the reference.
#[derive(Debug, Clone, PartialEq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ReflogEntryDto {
    /// Its number in `<ref>@{n}`; 0 is the newest.
    pub index: u32,
    /// Where the reference pointed after the change (all zeros when it was deleted).
    pub new_id: String,
    /// Where it pointed before (all zeros when it was created).
    pub old_id: String,
    pub committer: String,
    /// Seconds since the epoch.
    pub time: f64,
    /// What git wrote (`commit: …`, `checkout: moving from a to b`, `reset: moving to …`).
    pub message: String,
}

/// A reflog, newest first, with the references that have one.
#[derive(Debug, Clone, PartialEq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ReflogDto {
    /// `HEAD`, then the local branches with a reflog (full names).
    pub references: Vec<String>,
    pub entries: Vec<ReflogEntryDto>,
    /// More entries exist than were read (the oldest are left out).
    pub truncated: bool,
}

/// The reflog of `reference` (`HEAD` or `refs/heads/<name>`) in repository `id`.
pub async fn get(
    sessions: &RepoSessions,
    id: RepoId,
    reference: String,
) -> Result<ReflogDto, OperationsError> {
    let session = sessions.get(id)?;
    let repo = session.repo.clone();
    let (references, log) = blocking(move || {
        let repo = repo.local();
        Ok::<_, git_core::reflog::ReflogError>((
            reflog_references(&repo)?,
            reflog(&repo, &reference)?,
        ))
    })
    .await??;
    Ok(ReflogDto {
        references,
        entries: log
            .entries
            .into_iter()
            .map(|entry| ReflogEntryDto {
                index: entry.index,
                new_id: entry.new_id,
                old_id: entry.old_id,
                committer: entry.committer,
                #[allow(clippy::cast_precision_loss)] // Seconds fit an f64 exactly until 2^53.
                time: entry.time as f64,
                message: entry.message,
            })
            .collect(),
        truncated: log.truncated,
    })
}
