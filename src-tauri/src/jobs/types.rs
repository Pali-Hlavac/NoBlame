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
