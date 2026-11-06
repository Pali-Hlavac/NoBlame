//! What the job commands take and return, and the event that reports a job's progress.

use serde::{Deserialize, Serialize};
use specta::Type;

/// Identifies a job for as long as the app runs.
pub type JobId = u32;

/// What a job does.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum JobKindDto {
    /// `git fetch`.
    Fetch,
    /// `git pull`.
    Pull,
    /// `git push`.
    Push,
}

/// Where a job is in its life.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum JobStateDto {
    /// git is running.
    Running,
    /// git finished with status 0.
    Succeeded,
    /// git failed (or could not run); `message` says why.
    Failed,
    /// The user cancelled it; git and everything it started were killed.
    Cancelled,
}

/// How far a running job got, from git's last progress line.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct JobProgressDto {
    /// What git is doing (`Receiving objects`); `remote: ` phases are the server's.
    pub phase: String,
    /// Percent of this phase, when git knows the total.
    pub percent: Option<u8>,
    /// The rest of the line: counts, size and speed.
    pub detail: String,
}

/// A background job as the UI shows it.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct JobDto {
    /// Its id.
    pub id: JobId,
    /// What it does.
    pub kind: JobKindDto,
    /// A short title (`Fetch origin`, `Fetch all remotes and prune`).
    pub title: String,
    /// The repository it works on, as given when it started.
    pub repo_path: String,
    /// The equivalent command line, to run it by hand.
    pub command: String,
    /// Running, or how it ended.
    pub state: JobStateDto,
    /// The last progress line while running.
    pub progress: Option<JobProgressDto>,
    /// How it ended in words (`2 new, 1 updated`, git's error); `null` while running.
    pub message: Option<String>,
    /// Lines in its log so far (progress updates excluded); the UI refetches the log when it
    /// grows.
    pub log_lines: u32,
    /// Start time, seconds since the Unix epoch.
    pub started_at: f64,
    /// End time, seconds since the Unix epoch; `null` while running.
    pub finished_at: Option<f64>,
}

/// A job started, made progress or ended. Sent at most every 100 ms per job while it runs,
/// and always when it ends.
#[derive(Debug, Clone, Serialize, Deserialize, Type, tauri_specta::Event)]
#[serde(rename_all = "camelCase")]
pub struct JobUpdated {
    /// The job as it is now.
    pub job: JobDto,
}

/// Which remotes a fetch talks to.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Type)]
#[serde(rename_all = "camelCase", tag = "type", content = "name")]
pub enum FetchTargetDto {
    /// What plain `git fetch` picks: the current branch's remote, else `origin`.
    Default,
    /// Every remote.
    All,
    /// One remote by name.
    Remote(String),
}

/// A fetch to start.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct FetchRequestDto {
    /// The repository (its work tree or `.git` folder); it need not be open.
    pub path: String,
    /// Which remotes.
    pub target: FetchTargetDto,
    /// Remove remote branches deleted on the remote.
    pub prune: bool,
}

/// How a pull joins the upstream's commits with the branch's own.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum PullModeDto {
    /// As the user's config says (`pull.rebase`, `pull.ff`).
    Default,
    /// Merge.
    Merge,
    /// Rebase the branch's own commits onto the upstream.
    Rebase,
    /// Only fast-forward.
    FastForwardOnly,
}

/// A pull of the current branch from its upstream.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct PullRequestDto {
    /// The repository's work tree; it need not be open.
    pub path: String,
    pub mode: PullModeDto,
}

/// A local branch to push.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct PushBranchDto {
    /// The local branch.
    pub local: String,
    /// The branch on the remote it goes to.
    pub remote_branch: String,
    /// Make it the local branch's upstream.
    pub set_upstream: bool,
    /// Also push annotated tags on the pushed commits.
    pub follow_tags: bool,
    /// Replace the remote branch even when that removes commits from it.
    pub force: bool,
    /// With `force`: the full id the remote branch had when shown (its remote-tracking
    /// branch); it is replaced only if still there. `null`: it must not exist yet.
    pub expected: Option<String>,
}

/// What to push.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Type)]
#[serde(rename_all = "camelCase", tag = "type")]
pub enum PushWhatDto {
    /// A local branch.
    Branch(PushBranchDto),
    /// A tag, by name.
    Tag {
        /// The tag (`v1.0`).
        name: String,
    },
    /// Delete a branch or tag on the remote.
    Delete {
        /// Its full name on the remote: `refs/heads/x` or `refs/tags/v1`.
        reference: String,
    },
}

/// A push to start.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct PushRequestDto {
    /// The repository; it need not be open.
    pub path: String,
    /// The remote's name.
    pub remote: String,
    pub what: PushWhatDto,
}
