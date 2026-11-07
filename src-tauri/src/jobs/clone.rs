//! Starting a clone job. The folder is checked first (a new one, or an empty one) and git runs
//! in the nearest folder above it that exists. A cancelled clone's folder is removed again (git
//! cleans up after its own failures, but not when it is killed). The UI opens the repository
//! when the job succeeded.

use std::path::{Path, PathBuf};
use std::sync::Arc;

use git_core::cli::Git;
use git_core::remote::{
    CloneFilter, CloneOptions, CloneTarget, check_clone_target, clone_command, clone_hint,
    remove_partial_clone,
};
use serde::Deserialize;
use specta::Type;

use super::registry::{JobRegistry, JobSpec};
use super::types::{JobId, JobKindDto, JobStateDto};
use crate::git_env::GitEnvError;
use crate::repository::{RepositoryError, blocking};

/// How much of the history's contents to download up front.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum CloneFilterDto {
    /// Everything.
    None,
    /// File contents when needed (`--filter=blob:none`).
    Blobless,
    /// Folders and file contents of old commits when needed (`--filter=tree:0`).
    Treeless,
}

/// A repository to clone and how.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct CloneRequestDto {
    /// The repository's address.
    pub url: String,
    /// The new repository's folder (full path): new, or empty.
    pub folder: String,
    /// The branch or tag to check out instead of the remote's default.
    pub branch: Option<String>,
    /// Only the newest commits (a shallow clone).
    pub depth: Option<u32>,
    pub single_branch: bool,
    pub filter: CloneFilterDto,
    pub recurse_submodules: bool,
}

/// Starts `git clone` as a job and returns its id.
pub async fn start(
    registry: &Arc<JobRegistry>,
    request: CloneRequestDto,
) -> Result<JobId, RepositoryError> {
    let folder = PathBuf::from(&request.folder);
    let target = blocking(move || check_clone_target(&folder)).await??;
    let git = Git::locate().map_err(GitEnvError::from)?;
    let options = CloneOptions {
        url: request.url,
        branch: request.branch.filter(|branch| !branch.trim().is_empty()),
        depth: request.depth,
        single_branch: request.single_branch,
        filter: match request.filter {
            CloneFilterDto::None => CloneFilter::None,
            CloneFilterDto::Blobless => CloneFilter::Blobless,
            CloneFilterDto::Treeless => CloneFilter::Treeless,
        },
        recurse_submodules: request.recurse_submodules,
    };
    let command = clone_command(&git, &target, &options)?;
    let shown = target.folder.display().to_string();
    Ok(registry.start(JobSpec {
        kind: JobKindDto::Clone,
        title: format!("Clone {}", folder_name(&target.folder)),
        repo_path: request.folder,
        steps: vec![command],
        describe: Box::new(move |_| format!("Cloned into {shown}")),
        hint: Some(clone_hint),
        on_end: Some(Box::new(move |state| cleaned_up(state, &target))),
    }))
}

fn folder_name(folder: &Path) -> String {
    folder.file_name().map_or_else(
        || folder.display().to_string(),
        |name| name.to_string_lossy().into_owned(),
    )
}

/// After a cancel, removes what the clone wrote and says so.
fn cleaned_up(state: JobStateDto, target: &CloneTarget) -> Option<String> {
    if state != JobStateDto::Cancelled {
        return None;
    }
    Some(match remove_partial_clone(target) {
        Ok(()) if target.existed => "What it had written in the folder was removed.".to_owned(),
        Ok(()) => "The partly cloned folder was removed.".to_owned(),
        Err(error) => {
            tracing::warn!(%error, "removing a cancelled clone failed");
            format!("The partly cloned folder could not be removed: {error}")
        }
    })
}

#[cfg(test)]
mod tests {
    use std::path::Path;

    use super::folder_name;

    #[test]
    fn names_the_folder() {
        assert_eq!(folder_name(Path::new("/code/noblame")), "noblame");
    }
}
