//! Starting fetch jobs. The repository is opened first (refused when untrusted, like any
//! other), but it need not be open in a tab: the Repositories module fetches closed ones too.

use std::path::PathBuf;
use std::sync::Arc;

use git_core::cli::Git;
use git_core::remote::{FetchOptions, FetchTarget, fetch_command, summarize_fetch};
use git_core::repo::{RepoKind, Repository};

use super::registry::{JobRegistry, JobSpec};
use super::types::{FetchRequestDto, FetchTargetDto, JobId, JobKindDto};
use crate::git_env::GitEnvError;
use crate::repository::{RepositoryError, blocking};

/// Starts `git fetch` as a job and returns its id.
pub async fn start(
    registry: &Arc<JobRegistry>,
    request: FetchRequestDto,
) -> Result<JobId, RepositoryError> {
    let path = PathBuf::from(&request.path);
    let repo = blocking(move || Repository::discover(&path)).await??;
    let info = repo.info();
    let dir = match (&info.work_dir, info.kind) {
        (Some(work_dir), kind) if kind != RepoKind::Bare => work_dir.clone(),
        _ => info.git_dir.clone(),
    };
    let git = Git::locate().map_err(GitEnvError::from)?;
    let target = match request.target {
        FetchTargetDto::Default => FetchTarget::Default,
        FetchTargetDto::All => FetchTarget::All,
        FetchTargetDto::Remote(name) => FetchTarget::Remote(name),
    };
    let title = title(&target, request.prune);
    let options = FetchOptions {
        target,
        prune: request.prune,
    };
    let command = fetch_command(&git, &dir, &options).map_err(GitEnvError::from)?;
    Ok(registry.start(JobSpec {
        kind: JobKindDto::Fetch,
        title,
        repo_path: request.path,
        command,
        describe: Box::new(|output| describe(&output.stderr_lossy())),
    }))
}

fn title(target: &FetchTarget, prune: bool) -> String {
    let what = match target {
        FetchTarget::Default => "Fetch".to_owned(),
        FetchTarget::All => "Fetch all remotes".to_owned(),
        FetchTarget::Remote(name) => format!("Fetch {name}"),
    };
    if prune {
        format!("{what} and prune")
    } else {
        what
    }
}

/// `2 new, 1 updated, 1 pruned`, or that nothing changed.
fn describe(stderr: &str) -> String {
    let summary = summarize_fetch(stderr);
    if summary.is_empty() {
        return "Already up to date".to_owned();
    }
    let parts = [
        (summary.new, "new"),
        (summary.updated, "updated"),
        (summary.pruned, "pruned"),
        (summary.rejected, "rejected"),
    ];
    parts
        .iter()
        .filter(|(count, _)| *count > 0)
        .map(|(count, word)| format!("{count} {word}"))
        .collect::<Vec<_>>()
        .join(", ")
}

#[cfg(test)]
mod tests {
    use git_core::remote::FetchTarget;

    use super::{describe, title};

    #[test]
    fn titles_say_what_runs() {
        assert_eq!(title(&FetchTarget::Default, false), "Fetch");
        assert_eq!(
            title(&FetchTarget::All, true),
            "Fetch all remotes and prune"
        );
        assert_eq!(
            title(&FetchTarget::Remote("origin".into()), false),
            "Fetch origin"
        );
    }

    #[test]
    fn describes_what_changed() {
        assert_eq!(describe(""), "Already up to date");
        assert_eq!(
            describe(" * [new branch] a -> origin/a\n - [deleted] (none) -> origin/b\n"),
            "1 new, 1 pruned"
        );
    }
}
