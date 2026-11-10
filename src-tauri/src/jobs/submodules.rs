//! Initializing and updating submodules as a job: it may clone them, so it shows progress, can
//! be cancelled and asks for credentials like a fetch.

use std::sync::Arc;

use git_core::submodule::{submodule_dir, submodule_hint, update_command, updated_count};

use super::registry::{JobRegistry, JobSpec};
use super::target::JobTarget;
use super::types::{JobId, JobKindDto};
use crate::repository::RepositoryError;

/// Starts `git submodule update --init --recursive` in the repository at `path` for the
/// submodules at `paths` (relative, `/` separators), or all of them when empty.
pub async fn update(
    registry: &Arc<JobRegistry>,
    path: String,
    paths: Vec<String>,
) -> Result<JobId, RepositoryError> {
    let target = JobTarget::open(&path).await?;
    let work_tree = target.work_tree()?;
    for submodule in &paths {
        submodule_dir(&work_tree, submodule)?;
    }
    let title = match paths.as_slice() {
        [] => "Update submodules".to_owned(),
        [one] => format!("Update {one}"),
        many => format!("Update {} submodules", many.len()),
    };
    Ok(registry.start(JobSpec {
        kind: JobKindDto::SubmoduleUpdate,
        title,
        repo_path: path,
        steps: vec![update_command(&target.git, &work_tree, &paths)],
        describe: Box::new(|output| describe(updated_count(&output.combined()))),
        hint: Some(submodule_hint),
        on_end: None,
    }))
}

/// `2 updated`, or that nothing had to change.
fn describe(updated: usize) -> String {
    match updated {
        0 => "Already up to date".to_owned(),
        count => format!("{count} updated"),
    }
}

#[cfg(test)]
mod tests {
    use super::describe;

    #[test]
    fn says_how_many_moved() {
        assert_eq!(describe(0), "Already up to date");
        assert_eq!(describe(2), "2 updated");
    }
}
