//! Starting pull and push jobs, and listing remotes. Names from the UI are checked as branch or
//! tag names before they go into a refspec, so a refspec can never gain a second `:` or a
//! leading `+`.

use std::sync::Arc;

use git_core::branch::{RefNamespace, validate_name};
use git_core::remote::{
    Lease, PullMode, PushOptions, PushWhat, describe_pull, describe_push, pull_command, pull_hint,
    push_command, push_hint, remote_names, summarize_push, upstream_push,
};

use super::registry::{JobRegistry, JobSpec};
use super::target::JobTarget;
use super::types::{JobId, JobKindDto, PullModeDto, PullRequestDto, PushRequestDto, PushWhatDto};
use git_core::diff::parse_object_id;

use crate::git_env::GitEnvError;
use crate::repository::{RepositoryError, blocking};

/// Starts `git pull` of the current branch.
pub async fn pull(
    registry: &Arc<JobRegistry>,
    request: PullRequestDto,
) -> Result<JobId, RepositoryError> {
    let target = JobTarget::open(&request.path).await?;
    let work_tree = target.work_tree()?;
    let branch = target
        .repo
        .local()
        .head_name()
        .ok()
        .flatten()
        .map(|name| name.shorten().to_string());
    let (mode, how) = match request.mode {
        PullModeDto::Default => (PullMode::Default, ""),
        PullModeDto::Merge => (PullMode::Merge, " (merge)"),
        PullModeDto::Rebase => (PullMode::Rebase, " (rebase)"),
        PullModeDto::FastForwardOnly => (PullMode::FastForwardOnly, " (fast-forward only)"),
    };
    let title = match branch {
        Some(branch) => format!("Pull {branch}{how}"),
        None => format!("Pull{how}"),
    };
    Ok(registry.start(JobSpec {
        kind: JobKindDto::Pull,
        title,
        repo_path: request.path,
        command: pull_command(&target.git, &work_tree, mode),
        describe: Box::new(|output| describe_pull(&output.stdout_lossy(), &output.stderr_lossy())),
        hint: Some(pull_hint),
    }))
}

/// Starts `git push`.
pub async fn push(
    registry: &Arc<JobRegistry>,
    request: PushRequestDto,
) -> Result<JobId, RepositoryError> {
    let target = JobTarget::open(&request.path).await?;
    let remote = request.remote;
    let (what, title) = match request.what {
        PushWhatDto::Branch(branch) => {
            validate_name(RefNamespace::Branch, &branch.local)?;
            validate_name(RefNamespace::Branch, &branch.remote_branch)?;
            let force = if branch.force { " (force)" } else { "" };
            let title = format!(
                "{}{force}",
                branch_title(&branch.local, &remote, &branch.remote_branch)
            );
            let force = if branch.force {
                Some(match branch.expected {
                    Some(id) => Lease::At(parse_object_id(&id)?),
                    None => Lease::Absent,
                })
            } else {
                None
            };
            let what = PushWhat::Branch {
                local: branch.local,
                remote_branch: branch.remote_branch,
                set_upstream: branch.set_upstream,
                follow_tags: branch.follow_tags,
                force,
            };
            (what, title)
        }
        PushWhatDto::Tag { name } => {
            validate_name(RefNamespace::Tag, &name)?;
            let title = format!("Push tag {name} to {remote}");
            (PushWhat::Tag(name), title)
        }
        PushWhatDto::Delete { reference } => {
            let (namespace, name) = if let Some(name) = reference.strip_prefix("refs/heads/") {
                (RefNamespace::Branch, name)
            } else if let Some(name) = reference.strip_prefix("refs/tags/") {
                (RefNamespace::Tag, name)
            } else {
                return Err(RepositoryError::Branch(
                    git_core::branch::BranchError::InvalidName {
                        name: reference,
                        reason: "only branches and tags can be deleted on a remote".into(),
                    },
                ));
            };
            validate_name(namespace, name)?;
            let title = format!("Delete {name} on {remote}");
            (PushWhat::Delete(reference), title)
        }
    };
    start_push(
        registry,
        &target,
        request.path,
        PushOptions { remote, what },
        title,
    )
}

/// Starts `git push` of the current branch to its upstream: the repository's quick Push and
/// Push all, which have no dialog to ask where.
pub async fn push_current(
    registry: &Arc<JobRegistry>,
    path: String,
) -> Result<JobId, RepositoryError> {
    let target = JobTarget::open(&path).await?;
    let repo = target.repo.clone();
    let upstream = blocking(move || upstream_push(&repo.local())).await??;
    let title = branch_title(&upstream.branch, &upstream.remote, &upstream.remote_branch);
    let what = PushWhat::Branch {
        local: upstream.branch,
        remote_branch: upstream.remote_branch,
        set_upstream: false,
        follow_tags: false,
        force: None,
    };
    let options = PushOptions {
        remote: upstream.remote,
        what,
    };
    start_push(registry, &target, path, options, title)
}

fn start_push(
    registry: &Arc<JobRegistry>,
    target: &JobTarget,
    path: String,
    options: PushOptions,
    title: String,
) -> Result<JobId, RepositoryError> {
    let command = push_command(&target.git, &target.dir, &options).map_err(GitEnvError::from)?;
    Ok(registry.start(JobSpec {
        kind: JobKindDto::Push,
        title,
        repo_path: path,
        command,
        describe: Box::new(|output| describe_push(summarize_push(&output.stdout_lossy()))),
        hint: Some(push_hint),
    }))
}

/// `Push main to origin`, or `Push main to origin/release` when the names differ.
fn branch_title(local: &str, remote: &str, remote_branch: &str) -> String {
    if remote_branch == local {
        format!("Push {local} to {remote}")
    } else {
        format!("Push {local} to {remote}/{remote_branch}")
    }
}

/// The repository's remotes, sorted.
pub async fn remotes(path: String) -> Result<Vec<String>, RepositoryError> {
    let target = JobTarget::open(&path).await?;
    blocking(move || remote_names(&target.repo.local())).await
}
