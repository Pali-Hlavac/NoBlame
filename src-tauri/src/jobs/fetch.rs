//! Starting fetch jobs. The repository is opened first (refused when untrusted, like any
//! other), but it need not be open in a tab: the Repositories module fetches closed ones too.

use std::sync::Arc;

use git_core::remote::{
    FetchOptions, FetchTarget, fetch_all_remotes, fetch_commands, summarize_fetch,
};

use super::registry::{JobRegistry, JobSpec};
use super::ssh::{default_remote, with_key};
use super::target::JobTarget;
use super::types::{FetchRequestDto, FetchTargetDto, JobId, JobKindDto};
use crate::git_env::GitEnvError;
use crate::repository::RepositoryError;
use crate::settings::SettingsStore;

/// Starts `git fetch` as a job and returns its id.
pub async fn start(
    registry: &Arc<JobRegistry>,
    settings: &SettingsStore,
    request: FetchRequestDto,
) -> Result<JobId, RepositoryError> {
    let submodules = settings.load()?.submodules.fetch_submodules;
    let target_repo = JobTarget::open(&request.path).await?;
    let target = match request.target {
        FetchTargetDto::Default => FetchTarget::Default,
        FetchTargetDto::All => FetchTarget::All,
        FetchTargetDto::Remote(name) => FetchTarget::Remote(name),
    };
    let title = title(&target, request.prune);
    // The remote of each step, for its SSH key: one per remote for Fetch all.
    let remotes = match &target {
        FetchTarget::Remote(name) => vec![name.clone()],
        FetchTarget::All => fetch_all_remotes(&target_repo.repo.local()),
        FetchTarget::Default => Vec::new(),
    };
    let options = FetchOptions {
        target,
        prune: request.prune,
        submodules,
    };
    // Fetch all: one fetch per remote, so each shows its progress.
    let steps = fetch_commands(
        &target_repo.git,
        &target_repo.dir,
        &target_repo.repo.local(),
        &options,
    )
    .map_err(GitEnvError::from)?;
    let steps = if remotes.len() == steps.len() {
        steps
            .into_iter()
            .zip(&remotes)
            .map(|(step, remote)| with_key(step, registry, &target_repo, remote))
            .collect()
    } else {
        let remote = default_remote(&target_repo);
        steps
            .into_iter()
            .map(|step| with_key(step, registry, &target_repo, &remote))
            .collect()
    };
    Ok(registry.start(JobSpec {
        kind: JobKindDto::Fetch,
        title,
        repo_path: request.path,
        steps,
        describe: Box::new(|output| describe(&output.stderr_lossy())),
        hint: None,
        on_end: None,
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
