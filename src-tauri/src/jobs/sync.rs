//! Starting pull and push jobs, and listing remotes. Names from the UI are checked as branch or
//! tag names before they go into a refspec, so a refspec can never gain a second `:` or a
//! leading `+`.

use std::sync::Arc;

use git_core::branch::{RefNamespace, validate_name};
use git_core::remote::{
    Lease, PullMode, PushOptions, PushWhat, describe_pull, describe_push, pull_command, pull_hint,
    push_command, push_hint, remote_names, summarize_push,
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
            let to = if branch.remote_branch == branch.local {
                remote.clone()
            } else {
                format!("{remote}/{}", branch.remote_branch)
            };
            let force = if branch.force { " (force)" } else { "" };
            let title = format!("Push {} to {to}{force}", branch.local);
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
    let options = PushOptions { remote, what };
    let command = push_command(&target.git, &target.dir, &options).map_err(GitEnvError::from)?;
    Ok(registry.start(JobSpec {
        kind: JobKindDto::Push,
        title,
        repo_path: request.path,
        command,
        describe: Box::new(|output| describe_push(summarize_push(&output.stdout_lossy()))),
        hint: Some(push_hint),
    }))
}

/// The repository's remotes, sorted.
pub async fn remotes(path: String) -> Result<Vec<String>, RepositoryError> {
    let target = JobTarget::open(&path).await?;
    blocking(move || remote_names(&target.repo.local())).await
}
