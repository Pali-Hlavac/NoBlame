//! What the patch commands take and return.

use git_core::patch::{
    PatchCheck, PatchCommits, PatchContents, PatchCount, PatchFit, PatchMail, PatchedPath,
};
use serde::{Deserialize, Serialize};
use specta::Type;

/// Which commits get patches: `tip` alone, or the commits after `base` up to `tip`.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct PatchCommitsDto {
    /// The newest commit (an id, branch or tag).
    pub tip: String,
    /// The commit (or branch, tag) the patches start after; `null`: only `tip`.
    pub base: Option<String>,
}

impl From<PatchCommitsDto> for PatchCommits {
    fn from(commits: PatchCommitsDto) -> Self {
        Self {
            tip: commits.tip,
            base: commits.base,
        }
    }
}

/// How many commits get a patch, and how many merges are left out.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct PatchCountDto {
    pub commits: u32,
    pub merges: u32,
}

impl From<PatchCount> for PatchCountDto {
    fn from(count: PatchCount) -> Self {
        Self {
            commits: count.commits,
            merges: count.merges,
        }
    }
}

/// Where patches are written.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum PatchOutputDto {
    /// One file holding them all, one after the other.
    File,
    /// One file per commit in a folder.
    Folder,
}

/// Patches to save; the app asks where.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct SavePatchesRequestDto {
    pub commits: PatchCommitsDto,
    pub output: PatchOutputDto,
    /// The file name proposed (for `file`).
    pub file_name: String,
}

/// Patches saved.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct SavedPatchesDto {
    /// The file, or the folder holding the files.
    pub path: String,
    /// Commits that got a patch.
    pub commits: u32,
    /// Files written.
    pub files: u32,
}

/// One mail of a patch file: one commit for `git am`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct PatchMailDto {
    /// The commit's summary (without `[PATCH 1/3]`).
    pub subject: String,
    pub author: String,
    /// False for a mail without changes (a cover letter).
    pub has_diff: bool,
}

impl From<PatchMail> for PatchMailDto {
    fn from(mail: PatchMail) -> Self {
        Self {
            subject: mail.subject,
            author: mail.author,
            has_diff: mail.has_diff,
        }
    }
}

/// What a patch file holds.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase", tag = "kind")]
pub enum PatchContentsDto {
    /// Mails (from `git format-patch`), each a commit.
    Mailbox { mails: Vec<PatchMailDto> },
    /// A diff without a message.
    Diff,
    /// Nothing git could apply.
    NotAPatch,
}

impl From<PatchContents> for PatchContentsDto {
    fn from(contents: PatchContents) -> Self {
        match contents {
            PatchContents::Mailbox(mails) => Self::Mailbox {
                mails: mails.into_iter().map(PatchMailDto::from).collect(),
            },
            PatchContents::Diff => Self::Diff,
            PatchContents::NotAPatch => Self::NotAPatch,
        }
    }
}

/// A chosen patch file and what it holds.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct PatchFileDto {
    /// The full path, as chosen.
    pub path: String,
    /// The file name.
    pub name: String,
    pub contents: PatchContentsDto,
}

/// How patches are applied.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum ApplyModeDto {
    /// Each mail becomes a commit (`git am`).
    Commits,
    /// Only the files change (`git apply`).
    Files,
}

/// Whether patches apply to the working tree as it is.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase", tag = "kind")]
pub enum PatchFitDto {
    /// As they are.
    Clean,
    /// With a three-way merge, cleanly.
    ThreeWay,
    /// With a three-way merge leaving conflicts.
    Conflicts,
    /// Not at all; `message` is git's reason.
    Fails { message: String },
}

impl From<PatchFit> for PatchFitDto {
    fn from(fit: PatchFit) -> Self {
        match fit {
            PatchFit::Clean => Self::Clean,
            PatchFit::ThreeWay => Self::ThreeWay,
            PatchFit::Conflicts => Self::Conflicts,
            PatchFit::Fails { output } => Self::Fails { message: output },
        }
    }
}

/// A file the patches change; `null` counts for binary files.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct PatchedPathDto {
    pub path: String,
    pub added: Option<u32>,
    pub removed: Option<u32>,
}

impl From<PatchedPath> for PatchedPathDto {
    fn from(path: PatchedPath) -> Self {
        Self {
            path: path.path,
            added: path.added,
            removed: path.removed,
        }
    }
}

/// The chosen files, whether they apply and the files they change.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct PatchCheckDto {
    /// In the order they apply (by file name).
    pub files: Vec<PatchFileDto>,
    pub fit: PatchFitDto,
    /// The files they change (the first 500).
    pub paths: Vec<PatchedPathDto>,
    /// How many files they change.
    pub total_paths: u32,
}

impl PatchCheckDto {
    /// The DTO of `check` for `files`.
    pub fn new(files: Vec<PatchFileDto>, check: PatchCheck) -> Self {
        Self {
            files,
            fit: check.fit.into(),
            paths: check.paths.into_iter().map(PatchedPathDto::from).collect(),
            total_paths: u32::try_from(check.total_paths).unwrap_or(u32::MAX),
        }
    }
}

/// How applying ended.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum PatchOutcomeDto {
    /// Each mail became a commit.
    Committed,
    /// `git am` stopped on a mail that did not apply; it is in progress.
    Stopped,
    /// The files changed (not staged).
    Applied,
    /// A three-way merge changed and staged the files.
    Merged,
    /// A three-way merge left conflicts to resolve.
    Conflicts,
}
