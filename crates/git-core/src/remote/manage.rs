//! Managing remotes: listing them with their URLs and what depends on them (read with gix), and
//! adding, renaming and removing them or changing their URLs with `git remote`, which also
//! renames or deletes their remote branches and fixes or drops the upstreams that name them.

use std::collections::HashMap;
use std::path::Path;

use gix::bstr::{BStr, ByteSlice};
use tokio_util::sync::CancellationToken;

use crate::branch::{BranchError, accepted};
use crate::cli::Git;

use super::validate::{validate_remote_name, validate_url};

use super::validate::REMOTES;

/// A remote as the Remotes dialog shows it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RemoteInfo {
    /// Its name (`origin`).
    pub name: String,
    /// Where it fetches from (the first `remote.<name>.url`).
    pub url: Option<String>,
    /// Where it pushes to when that differs (the first `remote.<name>.pushurl`).
    pub push_url: Option<String>,
    /// URLs beyond the first of each kind (git pushes to every push URL); edited in a terminal.
    pub extra_urls: usize,
    /// Its remote branches here (`refs/remotes/<name>/…`, without its `HEAD`).
    pub branches: usize,
    /// Local branches whose upstream is on it (`branch.<b>.remote`), by name.
    pub tracked_by: Vec<String>,
}

/// Every remote, sorted by name, with its URLs, remote branches and the branches tracking it.
pub fn remote_details(repo: &gix::Repository) -> Result<Vec<RemoteInfo>, BranchError> {
    let names: Vec<String> = repo
        .remote_names()
        .into_iter()
        .map(|name| name.to_string())
        .collect();
    let config = repo.config_snapshot();
    let file = config.plumbing();
    let mut branches = branch_counts(repo, &names)?;
    let mut tracked_by = tracking_branches(file);
    Ok(names
        .into_iter()
        .map(|name| {
            let subsection = Some(BStr::new(name.as_bytes()));
            let urls = file
                .strings_by("remote", subsection, "url")
                .unwrap_or_default();
            let push_urls = file
                .strings_by("remote", subsection, "pushurl")
                .unwrap_or_default();
            RemoteInfo {
                url: urls.first().map(|url| url.to_str_lossy().into_owned()),
                push_url: push_urls.first().map(|url| url.to_str_lossy().into_owned()),
                extra_urls: urls.len().saturating_sub(1) + push_urls.len().saturating_sub(1),
                branches: branches.remove(&name).unwrap_or(0),
                tracked_by: tracked_by.remove(&name).unwrap_or_default(),
                name,
            }
        })
        .collect())
}

/// Remote branches per remote, in one pass over `refs/remotes/`. A branch belongs to the
/// longest remote name that prefixes it (`a/b/main` is on `a/b` when both `a` and `a/b` exist).
fn branch_counts(
    repo: &gix::Repository,
    names: &[String],
) -> Result<HashMap<String, usize>, BranchError> {
    let gix_error = |error: gix::Error| BranchError::Gix(error.to_string());
    let mut counts = HashMap::new();
    let platform = repo.references().map_err(gix_error)?;
    for reference in platform.remote_branches().map_err(gix_error)? {
        let reference = reference.map_err(gix_error)?;
        let full = reference.name().as_bstr().to_str_lossy();
        let Some(short) = full.strip_prefix(REMOTES) else {
            continue;
        };
        let owner = names
            .iter()
            .filter(|name| {
                short
                    .strip_prefix(name.as_str())
                    .and_then(|rest| rest.strip_prefix('/'))
                    .is_some_and(|branch| branch != "HEAD")
            })
            .max_by_key(|name| name.len());
        if let Some(owner) = owner {
            *counts.entry(owner.clone()).or_insert(0) += 1;
        }
    }
    Ok(counts)
}

/// Local branches by the remote of their upstream, from `branch.<b>.remote` (sorted).
fn tracking_branches(file: &gix::config::File) -> HashMap<String, Vec<String>> {
    let mut by_remote: HashMap<String, Vec<String>> = HashMap::new();
    if let Some(sections) = file.sections_by_name("branch") {
        for section in sections {
            let (Some(branch), Some(remote)) =
                (section.header().subsection_name(), section.value("remote"))
            else {
                continue;
            };
            by_remote
                .entry(remote.to_str_lossy().into_owned())
                .or_default()
                .push(branch.to_str_lossy().into_owned());
        }
    }
    for branches in by_remote.values_mut() {
        branches.sort();
        branches.dedup();
    }
    by_remote
}

/// Adds the remote `name` fetching from `url` (`git remote add`); nothing is fetched yet.
pub async fn add_remote(
    git: &Git,
    dir: &Path,
    name: &str,
    url: &str,
    cancel: &CancellationToken,
) -> Result<String, BranchError> {
    validate_remote_name(name)?;
    validate_url(url)?;
    let command = git
        .command()
        .current_dir(dir)
        .args(["remote", "add"])
        .operands([name, url]);
    accepted(&command.output(cancel).await?)
}

/// Renames the remote `name` (`git remote rename`): its remote branches move to the new name
/// and the upstreams that named it follow.
pub async fn rename_remote(
    git: &Git,
    dir: &Path,
    name: &str,
    new_name: &str,
    cancel: &CancellationToken,
) -> Result<String, BranchError> {
    validate_remote_name(new_name)?;
    let command = git
        .command()
        .current_dir(dir)
        .args(["remote", "rename", "--no-progress"])
        .operands([name, new_name]);
    accepted(&command.output(cancel).await?)
}

/// Removes the remote `name` (`git remote remove`): its remote branches are deleted here and
/// the local branches tracking it lose their upstream. Nothing changes on the server.
pub async fn remove_remote(
    git: &Git,
    dir: &Path,
    name: &str,
    cancel: &CancellationToken,
) -> Result<String, BranchError> {
    let command = git
        .command()
        .current_dir(dir)
        .args(["remote", "remove"])
        .operands([name]);
    accepted(&command.output(cancel).await?)
}

/// Which URL of a remote to change.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum UrlKind {
    /// `remote.<name>.url`: fetching, and pushing when there is no push URL.
    Fetch,
    /// `remote.<name>.pushurl`.
    Push,
}

/// Sets the first URL of that kind (`git remote set-url [--push]`); a push URL is added when
/// the remote has none.
pub async fn set_remote_url(
    git: &Git,
    dir: &Path,
    name: &str,
    kind: UrlKind,
    url: &str,
    cancel: &CancellationToken,
) -> Result<String, BranchError> {
    validate_url(url)?;
    let mut command = git.command().current_dir(dir).args(["remote", "set-url"]);
    if kind == UrlKind::Push {
        command = command.arg("--push");
    }
    accepted(&command.operands([name, url]).output(cancel).await?)
}

/// Removes the remote's push URLs, so it pushes where it fetches from (`git config --local
/// --unset-all remote.<name>.pushurl`). Fine when there were none.
pub async fn unset_push_url(
    git: &Git,
    dir: &Path,
    name: &str,
    cancel: &CancellationToken,
) -> Result<String, BranchError> {
    validate_remote_name(name)?;
    let key = format!("remote.{name}.pushurl");
    let command = git
        .command()
        .current_dir(dir)
        .args(["config", "--local", "--unset-all"])
        .operands([key]);
    let output = command.output(cancel).await?;
    // Exit code 5: there was no such key.
    if output.code == Some(CONFIG_KEY_MISSING) {
        return Ok(String::new());
    }
    accepted(&output)
}

/// `git config --unset` exits with this when the key does not exist.
const CONFIG_KEY_MISSING: i32 = 5;
