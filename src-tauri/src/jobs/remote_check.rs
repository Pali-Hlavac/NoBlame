//! Asking a remote something without fetching, as jobs (credentials may be asked through
//! askpass): Test connection (`git ls-remote --heads`) and the server's default branch (`git
//! remote set-head --auto`). Started from the remote editor.

use std::sync::Arc;

use git_core::remote::{
    connection_hint, describe_connection, describe_set_head, ls_remote_command,
    set_head_auto_command, validate_remote_name,
};

use super::registry::{JobRegistry, JobSpec};
use super::target::JobTarget;
use super::types::{JobId, JobKindDto};
use crate::repository::RepositoryError;

/// Starts `git ls-remote --heads <remote>`.
pub async fn test_connection(
    registry: &Arc<JobRegistry>,
    path: String,
    remote: String,
) -> Result<JobId, RepositoryError> {
    validate_remote_name(&remote)?;
    let target = JobTarget::open(&path).await?;
    Ok(registry.start(JobSpec {
        kind: JobKindDto::TestConnection,
        title: format!("Test the connection to {remote}"),
        repo_path: path,
        steps: vec![ls_remote_command(&target.git, &target.dir, &remote)],
        describe: Box::new(|output| describe_connection(&output.stdout_lossy())),
        hint: Some(connection_hint),
        on_end: None,
    }))
}

/// Starts `git remote set-head --auto <remote>`.
pub async fn ask_default_branch(
    registry: &Arc<JobRegistry>,
    path: String,
    remote: String,
) -> Result<JobId, RepositoryError> {
    validate_remote_name(&remote)?;
    let target = JobTarget::open(&path).await?;
    Ok(registry.start(JobSpec {
        kind: JobKindDto::SetHead,
        title: format!("Ask {remote} for its default branch"),
        repo_path: path,
        steps: vec![set_head_auto_command(&target.git, &target.dir, &remote)],
        describe: Box::new(|output| describe_set_head(&output.combined())),
        hint: Some(connection_hint),
        on_end: None,
    }))
}
