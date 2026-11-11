//! Running a user script (Settings → Scripts) on a commit as a job: its output goes to the job's
//! log and the Git output window, like a fetch's.

use std::sync::Arc;

use git_core::script::{ScriptValues, script_command};
use serde::Deserialize;
use specta::Type;

use super::registry::{JobRegistry, JobSpec};
use super::target::JobTarget;
use super::types::{JobId, JobKindDto};
use crate::repository::RepositoryError;
use crate::settings::SettingsStore;

/// A script to run, and the commit it runs on.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct RunScriptRequestDto {
    /// The repository's folder.
    pub path: String,
    /// The script's name in Settings (its command is read from there).
    pub name: String,
    /// The commit's full id.
    pub sha: String,
    /// Its subject line.
    pub subject: String,
    /// The branch checked out; `null` when HEAD is detached.
    pub branch: Option<String>,
}

/// Starts the script named `request.name` from the settings.
pub async fn run(
    registry: &Arc<JobRegistry>,
    settings: &SettingsStore,
    request: RunScriptRequestDto,
) -> Result<JobId, RepositoryError> {
    let scripts = settings.load()?.scripts;
    let script = scripts
        .into_iter()
        .find(|script| script.name == request.name)
        .ok_or_else(|| RepositoryError::NoScript(request.name.clone()))?;
    let target = JobTarget::open(&request.path).await?;
    let values = ScriptValues {
        sha: request.sha,
        subject: request.subject,
        branch: request.branch,
        repo: request.path.clone(),
    };
    let command = script_command(&target.git, &target.dir, &script.command, &values)?;
    Ok(registry.start(JobSpec {
        kind: JobKindDto::Script,
        title: script.name,
        repo_path: request.path,
        steps: vec![command],
        describe: Box::new(|_| "Done".to_owned()),
        hint: None,
        on_end: None,
    }))
}
