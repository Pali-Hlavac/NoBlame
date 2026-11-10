//! Data shared with the frontend by the inspect commands.

use git_core::graph::{CommitDetails, CommitLink, GraphRef, Signature};
use git_core::stash::StashEntry;
use git_core::submodule::SubmoduleEntry;
use serde::Serialize;
use specta::Type;

use super::SignatureFormatDto;
use crate::repository::RefLabel;

/// Author or committer.
#[derive(Debug, Clone, PartialEq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct SignatureDto {
    /// Name.
    pub name: String,
    /// E-mail.
    pub email: String,
    /// Seconds since the epoch.
    pub time: f64,
    /// Time-zone offset in minutes east of UTC.
    pub offset_minutes: i32,
}

impl From<Signature> for SignatureDto {
    fn from(signature: Signature) -> Self {
        Self {
            name: signature.name,
            email: signature.email,
            // Exact to the second up to the year 287 million: f64 holds 53-bit integers.
            #[allow(clippy::cast_precision_loss)]
            time: signature.time as f64,
            offset_minutes: signature.offset_seconds / 60,
        }
    }
}

/// A parent or child commit and its row, so the UI can jump to it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct CommitLinkDto {
    /// Full commit id.
    pub id: String,
    /// Row in the graph; `None` when the tab's filter hides it.
    pub row: Option<u32>,
}

impl From<CommitLink> for CommitLinkDto {
    fn from(link: CommitLink) -> Self {
        Self {
            id: link.id,
            row: link.row,
        }
    }
}

/// Everything the Commit details module shows.
#[derive(Debug, Clone, PartialEq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct CommitDetailsDto {
    /// Row in the graph.
    pub row: u32,
    /// Full commit id.
    pub id: String,
    /// Parents, first parent first.
    pub parents: Vec<CommitLinkDto>,
    /// Commits that have this one as a parent, newest first.
    pub children: Vec<CommitLinkDto>,
    /// Who wrote the change.
    pub author: SignatureDto,
    /// Who created the commit.
    pub committer: SignatureDto,
    /// Whole message.
    pub message: String,
    /// What the commit is signed with; `null` when it is not signed
    /// (`verify_commit_signature` checks it).
    pub signature: Option<SignatureFormatDto>,
    /// References pointing at the commit.
    pub refs: Vec<RefLabel>,
    /// References containing the commit (at most 500).
    pub contained_in: Vec<RefLabel>,
    /// How many references contain the commit in total.
    pub contained_in_total: u32,
}

impl From<CommitDetails> for CommitDetailsDto {
    fn from(details: CommitDetails) -> Self {
        Self {
            row: details.row,
            id: details.id,
            parents: details
                .parents
                .into_iter()
                .map(CommitLinkDto::from)
                .collect(),
            children: details
                .children
                .into_iter()
                .map(CommitLinkDto::from)
                .collect(),
            author: details.author.into(),
            committer: details.committer.into(),
            message: details.message,
            signature: details.signature.map(SignatureFormatDto::from),
            refs: details.refs.iter().map(RefLabel::from).collect(),
            contained_in: details.contained_in.iter().map(RefLabel::from).collect(),
            contained_in_total: details.contained_in_total,
        }
    }
}

/// One branch, remote branch or tag, with the row and time of its commit.
#[derive(Debug, Clone, PartialEq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct RefEntry {
    /// Name, category and HEAD marker.
    pub label: RefLabel,
    /// Full id of the commit it points to (annotated tags peeled).
    pub target: String,
    /// Row of that commit, if it is in the graph.
    pub row: Option<u32>,
    /// Committer time of that commit in seconds since the epoch, for sorting by date; `null`
    /// when the target is not a commit of the history.
    pub commit_time: Option<f64>,
}

impl RefEntry {
    /// Builds an entry from a graph reference, its row and its commit's time.
    pub fn new(reference: &GraphRef, row: Option<u32>, commit_time: Option<i64>) -> Self {
        Self {
            label: RefLabel::from(reference),
            target: reference.target.to_string(),
            row,
            // Exact to the second up to the year 287 million: f64 holds 53-bit integers.
            #[allow(clippy::cast_precision_loss)]
            commit_time: commit_time.map(|time| time as f64),
        }
    }
}

/// One stash, newest first.
#[derive(Debug, Clone, PartialEq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct StashDto {
    /// `n` in `stash@{n}`.
    pub index: u32,
    /// Full id of the stash commit.
    pub id: String,
    /// Message as `git stash list` shows it.
    pub message: String,
    /// Branch it was made on, if known.
    pub branch: Option<String>,
    /// When it was made, seconds since the epoch.
    pub time: f64,
}

impl From<StashEntry> for StashDto {
    fn from(stash: StashEntry) -> Self {
        Self {
            index: stash.index,
            id: stash.id,
            message: stash.message,
            branch: stash.branch,
            // Exact to the second up to the year 287 million: f64 holds 53-bit integers.
            #[allow(clippy::cast_precision_loss)]
            time: stash.time as f64,
        }
    }
}

/// A submodule and its own submodules.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct SubmoduleDto {
    /// Name from `.gitmodules`.
    pub name: String,
    /// Path inside the superproject (`/` separators).
    pub path: String,
    /// Absolute path of its work tree.
    pub work_dir: String,
    /// Configured URL.
    pub url: Option<String>,
    /// Cloned and checked out.
    pub initialized: bool,
    /// The commit the superproject records for it (hex), if its index has one.
    pub recorded: Option<String>,
    /// The commit checked out in it (hex), when initialized; another than `recorded` means
    /// "new commits".
    pub checked_out: Option<String>,
    /// Nested submodules.
    pub children: Vec<SubmoduleDto>,
}

impl From<SubmoduleEntry> for SubmoduleDto {
    fn from(entry: SubmoduleEntry) -> Self {
        Self {
            name: entry.name,
            path: entry.path,
            work_dir: entry.work_dir,
            url: entry.url,
            initialized: entry.initialized,
            recorded: entry.recorded,
            checked_out: entry.checked_out,
            children: entry.children.into_iter().map(Self::from).collect(),
        }
    }
}
