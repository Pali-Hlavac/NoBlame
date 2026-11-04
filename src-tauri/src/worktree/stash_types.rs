//! What the stash commands take and return.

use git_core::stash::{ApplyOutcome, StashFiles};
use serde::{Deserialize, Serialize};
use specta::Type;

use crate::inspect::ChangedFileDto;

/// Changes to stash.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct StashRequestDto {
    /// The stash's message; git's `WIP on <branch>: …` when empty.
    pub message: String,
    /// Leave the staged changes in the working tree and the index too.
    pub keep_index: bool,
    /// Stash new files as well (they are deleted from the working tree).
    pub include_untracked: bool,
    /// Only these files (both names of a rename); `null`: every change.
    pub paths: Option<Vec<String>>,
}

/// The stash the user chose: `stash@{index}`, checked to still be `id` before anything runs.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct StashTargetDto {
    /// `n` in `stash@{n}`.
    pub index: u32,
    /// The stash commit's full id (hex).
    pub id: String,
}

/// Applying or popping a whole stash.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ApplyStashRequestDto {
    /// Which stash.
    pub stash: StashTargetDto,
    /// Drop it after applying without conflicts (`git stash pop`).
    pub pop: bool,
    /// Also restore what was staged (`--index`).
    pub restore_index: bool,
}

/// Applying some files of a stash.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ApplyStashFilesRequestDto {
    /// The stash commit's full id (hex).
    pub id: String,
    /// Tracked files, as listed in `changed` (both names of a rename).
    pub tracked: Vec<String>,
    /// Untracked files, as listed in `untracked`.
    pub untracked: Vec<String>,
}

/// What applying did.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ApplyOutcomeDto {
    /// What git printed.
    pub output: String,
    /// It applied with merge conflicts, now in the working tree; a pop kept the stash.
    pub conflicts: bool,
}

impl From<ApplyOutcome> for ApplyOutcomeDto {
    fn from(outcome: ApplyOutcome) -> Self {
        Self {
            output: outcome.output,
            conflicts: outcome.conflicts,
        }
    }
}

/// The files of one stash.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct StashFilesDto {
    /// The commit it was made on (hex).
    pub base: String,
    /// Tracked files it changed, against `base`, sorted by path (at most 5,000).
    pub changed: Vec<ChangedFileDto>,
    /// All changed tracked files.
    pub changed_total: u32,
    /// Untracked files it saved (each added), sorted by path (at most 5,000).
    pub untracked: Vec<ChangedFileDto>,
    /// All untracked files.
    pub untracked_total: u32,
}

impl From<StashFiles> for StashFilesDto {
    fn from(files: StashFiles) -> Self {
        Self {
            base: files.commits.base.to_string(),
            changed: files.changed.into_iter().map(Into::into).collect(),
            changed_total: u32::try_from(files.changed_total).unwrap_or(u32::MAX),
            untracked: files.untracked.into_iter().map(Into::into).collect(),
            untracked_total: u32::try_from(files.untracked_total).unwrap_or(u32::MAX),
        }
    }
}
