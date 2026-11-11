//! Downloading the contents of Git LFS files (`git lfs pull`) as a job: it talks to the LFS
//! server, may take long and can be cancelled.

use std::sync::Arc;

use git_core::lfs::lfs_pull_command;

use super::registry::{JobRegistry, JobSpec};
use super::target::JobTarget;
use super::types::{JobId, JobKindDto};
use crate::lfs::lfs_hint;
use crate::repository::RepositoryError;

/// Starts `git lfs pull` in the repository at `path`.
pub async fn pull(registry: &Arc<JobRegistry>, path: String) -> Result<JobId, RepositoryError> {
    let target = JobTarget::open(&path).await?;
    let work_tree = target.work_tree()?;
    Ok(registry.start(JobSpec {
        kind: JobKindDto::LfsPull,
        title: "Download LFS files".to_owned(),
        repo_path: path,
        steps: vec![lfs_pull_command(&target.git, &work_tree)],
        describe: Box::new(|_| "LFS files downloaded".to_owned()),
        hint: Some(lfs_hint),
        on_end: None,
    }))
}
