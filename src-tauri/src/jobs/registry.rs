//! The job registry: starts git commands in the background, keeps each one's state, progress
//! and log, cancels them, and reports changes with [`JobUpdated`] events (ADR 0011).

use std::collections::VecDeque;
use std::sync::{Arc, Mutex, MutexGuard, PoisonError};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use git_core::cli::{GitCommand, GitError, GitOutput, OutputLine};
use git_core::remote::parse_progress;
use tauri::AppHandle;
use tauri_specta::Event;
use tokio_util::sync::CancellationToken;

use super::types::{JobDto, JobId, JobKindDto, JobProgressDto, JobStateDto, JobUpdated};

/// Progress events per job are sent at most this often; state changes always go out.
const PROGRESS_INTERVAL: Duration = Duration::from_millis(100);
/// Lines kept per job log; older lines are dropped first.
const MAX_LOG_LINES: usize = 5_000;
/// Finished jobs kept for the jobs list; older ones are forgotten.
const MAX_FINISHED_JOBS: usize = 30;
/// Lines of git's error output a failed job's message keeps.
const FAILURE_LINES: usize = 6;

/// Turns a successful job's output into its message (`2 new, 1 updated`).
pub type Describe = Box<dyn FnOnce(&GitOutput) -> String + Send>;

/// A job to start.
pub struct JobSpec {
    pub kind: JobKindDto,
    pub title: String,
    pub repo_path: String,
    pub command: GitCommand,
    pub describe: Describe,
}

struct Entry {
    job: JobDto,
    cancel: CancellationToken,
    log: VecDeque<String>,
    last_sent: Instant,
}

#[derive(Default)]
struct Inner {
    next_id: JobId,
    /// Oldest first.
    jobs: Vec<Entry>,
}

/// Every job of this app run. Managed as `Arc<JobRegistry>`.
pub struct JobRegistry {
    app: AppHandle,
    inner: Mutex<Inner>,
}

impl JobRegistry {
    pub fn new(app: AppHandle) -> Self {
        Self {
            app,
            inner: Mutex::new(Inner::default()),
        }
    }

    fn lock(&self) -> MutexGuard<'_, Inner> {
        // A panic while holding the lock leaves plain data behind; keep using it.
        self.inner.lock().unwrap_or_else(PoisonError::into_inner)
    }

    fn send(&self, job: JobDto) {
        if let Err(error) = (JobUpdated { job }).emit(&self.app) {
            tracing::warn!(%error, "could not send a job update");
        }
    }

    /// Starts `spec` in the background and returns its id at once.
    pub fn start(self: &Arc<Self>, spec: JobSpec) -> JobId {
        let cancel = CancellationToken::new();
        let job = {
            let mut inner = self.lock();
            inner.next_id += 1;
            let job = JobDto {
                id: inner.next_id,
                kind: spec.kind,
                title: spec.title,
                repo_path: spec.repo_path,
                command: spec.command.display(),
                state: JobStateDto::Running,
                progress: None,
                message: None,
                log_lines: 0,
                started_at: now_seconds(),
                finished_at: None,
            };
            inner.jobs.push(Entry {
                job: job.clone(),
                cancel: cancel.clone(),
                log: VecDeque::new(),
                last_sent: Instant::now(),
            });
            job
        };
        let id = job.id;
        tracing::info!(id, command = %job.command, "job started");
        self.send(job);
        let registry = Arc::clone(self);
        let (command, describe) = (spec.command, spec.describe);
        tauri::async_runtime::spawn(async move {
            let result = command
                .stream(&cancel, |line| registry.on_line(id, line))
                .await;
            registry.finish(id, result, describe);
        });
        id
    }

    fn on_line(&self, id: JobId, line: OutputLine) {
        let update = {
            let mut inner = self.lock();
            let Some(entry) = inner.jobs.iter_mut().find(|entry| entry.job.id == id) else {
                return;
            };
            if let Some(progress) = parse_progress(&line.text) {
                let phase = if progress.remote {
                    format!("Remote: {}", progress.phase)
                } else {
                    progress.phase
                };
                entry.job.progress = Some(JobProgressDto {
                    phase,
                    percent: progress.percent,
                    detail: progress.detail,
                });
            }
            if !line.progress {
                if entry.log.len() == MAX_LOG_LINES {
                    entry.log.pop_front();
                }
                entry.log.push_back(line.text);
                entry.job.log_lines = u32::try_from(entry.log.len()).unwrap_or(u32::MAX);
            }
            (entry.last_sent.elapsed() >= PROGRESS_INTERVAL).then(|| {
                entry.last_sent = Instant::now();
                entry.job.clone()
            })
        };
        if let Some(job) = update {
            self.send(job);
        }
    }

    fn finish(&self, id: JobId, result: Result<GitOutput, GitError>, describe: Describe) {
        let (state, message) = match result {
            Ok(output) if output.success() => (JobStateDto::Succeeded, describe(&output)),
            Ok(output) => (JobStateDto::Failed, failure_message(&output.stderr_lossy())),
            Err(GitError::Cancelled { .. }) => (JobStateDto::Cancelled, "Cancelled".to_owned()),
            Err(error) => (JobStateDto::Failed, error.to_string()),
        };
        let job = {
            let mut inner = self.lock();
            let Some(entry) = inner.jobs.iter_mut().find(|entry| entry.job.id == id) else {
                return;
            };
            entry.job.state = state;
            entry.job.progress = None;
            entry.job.message = Some(message);
            entry.job.finished_at = Some(now_seconds());
            let job = entry.job.clone();
            forget_old(&mut inner.jobs);
            job
        };
        tracing::info!(id, state = ?job.state, message = ?job.message, "job finished");
        self.send(job);
    }

    /// Running and recent jobs, newest first.
    pub fn list(&self) -> Vec<JobDto> {
        self.lock()
            .jobs
            .iter()
            .rev()
            .map(|entry| entry.job.clone())
            .collect()
    }

    /// A job's log (progress updates left out); empty for an unknown job.
    pub fn log(&self, id: JobId) -> Vec<String> {
        self.lock()
            .jobs
            .iter()
            .find(|entry| entry.job.id == id)
            .map(|entry| entry.log.iter().cloned().collect())
            .unwrap_or_default()
    }

    /// Cancels a running job; false when it is unknown or already over.
    pub fn cancel(&self, id: JobId) -> bool {
        let inner = self.lock();
        let Some(entry) = inner.jobs.iter().find(|entry| entry.job.id == id) else {
            return false;
        };
        if entry.job.state != JobStateDto::Running {
            return false;
        }
        entry.cancel.cancel();
        true
    }
}

/// Keeps every running job and the newest [`MAX_FINISHED_JOBS`] finished ones.
fn forget_old(jobs: &mut Vec<Entry>) {
    let finished = jobs
        .iter()
        .filter(|entry| entry.job.state != JobStateDto::Running)
        .count();
    let mut excess = finished.saturating_sub(MAX_FINISHED_JOBS);
    jobs.retain(|entry| {
        if excess > 0 && entry.job.state != JobStateDto::Running {
            excess -= 1;
            false
        } else {
            true
        }
    });
}

/// git's explanation of a failure: its `fatal:` and `error:` lines, else its last lines.
pub fn failure_message(stderr: &str) -> String {
    let marked: Vec<&str> = stderr
        .lines()
        .filter_map(|line| {
            line.strip_prefix("fatal: ")
                .or_else(|| line.strip_prefix("error: "))
        })
        .collect();
    let lines: Vec<&str> = if marked.is_empty() {
        let all: Vec<&str> = stderr
            .lines()
            .filter(|line| !line.trim().is_empty())
            .collect();
        all[all.len().saturating_sub(FAILURE_LINES)..].to_vec()
    } else {
        marked.into_iter().take(FAILURE_LINES).collect()
    };
    if lines.is_empty() {
        "git failed without saying why.".to_owned()
    } else {
        lines.join("\n")
    }
}

fn now_seconds() -> f64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0.0, |elapsed| elapsed.as_secs_f64())
}

#[cfg(test)]
mod tests {
    use super::failure_message;

    #[test]
    fn keeps_gits_reasons() {
        let stderr = "fatal: 'nowhere' does not appear to be a git repository\n\
                      fatal: Could not read from remote repository.\n\n\
                      Please make sure you have the correct access rights\n\
                      and the repository exists.";
        assert_eq!(
            failure_message(stderr),
            "'nowhere' does not appear to be a git repository\nCould not read from remote repository."
        );
        assert_eq!(failure_message("odd\nthing\n"), "odd\nthing");
        assert_eq!(failure_message(""), "git failed without saying why.");
    }
}
