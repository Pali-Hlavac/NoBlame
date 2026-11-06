//! The repository's remotes and where the current branch pushes to, read with gix.

use gix::remote::Direction;

use crate::branch::BranchError;

const HEADS: &str = "refs/heads/";

/// Remote names (`origin`, `upstream`), sorted.
pub fn remote_names(repo: &gix::Repository) -> Vec<String> {
    repo.remote_names()
        .into_iter()
        .map(|name| name.to_string())
        .collect()
}

/// The current branch and the remote branch it pushes to (its upstream).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UpstreamPush {
    /// The current branch (`feature/x`).
    pub branch: String,
    /// The upstream's remote, by name (`origin`).
    pub remote: String,
    /// The upstream's branch on that remote (`feature/x`).
    pub remote_branch: String,
}

/// Where a plain Push of the current branch goes: its upstream, when that is a branch on a named
/// remote. Fails with [`BranchError::Detached`] or [`BranchError::NoRemoteUpstream`] otherwise
/// (no upstream, a local one, or a remote given as a URL), as the Push dialog must ask then.
pub fn upstream_push(repo: &gix::Repository) -> Result<UpstreamPush, BranchError> {
    let head = repo
        .head_name()
        .map_err(|error| BranchError::Gix(error.to_string()))?
        .ok_or(BranchError::Detached)?;
    let branch = head.shorten().to_string();
    let no_upstream = || BranchError::NoRemoteUpstream {
        branch: branch.clone(),
    };
    let remote = repo
        .branch_remote_name(head.shorten(), Direction::Fetch)
        .and_then(|name| name.as_symbol().map(str::to_owned))
        .filter(|name| name != ".")
        .ok_or_else(no_upstream)?;
    let merge = repo
        .branch_remote_ref_name(head.as_ref(), Direction::Fetch)
        .and_then(Result::ok)
        .ok_or_else(no_upstream)?;
    let remote_branch = merge
        .as_bstr()
        .to_string()
        .strip_prefix(HEADS)
        .map(str::to_owned)
        .ok_or_else(no_upstream)?;
    Ok(UpstreamPush {
        branch,
        remote,
        remote_branch,
    })
}
