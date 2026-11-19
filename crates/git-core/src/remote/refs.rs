//! The refs the remote editor shows: a remote's default branch, its remote branches here, and
//! the local branches (to choose one that tracks the remote). Read with gix.

use gix::bstr::ByteSlice;

use super::validate::REMOTES;

const HEADS: &str = "refs/heads/";

/// The branch `refs/remotes/<name>/HEAD` points at, if it is set.
pub fn remote_head(repo: &gix::Repository, name: &str) -> Option<String> {
    let reference = repo
        .try_find_reference(format!("{REMOTES}{name}/HEAD").as_str())
        .ok()??;
    let target = reference
        .target()
        .try_name()?
        .as_bstr()
        .to_str_lossy()
        .into_owned();
    target
        .strip_prefix(&format!("{REMOTES}{name}/"))
        .map(str::to_owned)
}

/// The remote branches of `name` here (`refs/remotes/<name>/…` without `HEAD`), sorted.
pub fn remote_branch_names(repo: &gix::Repository, name: &str) -> Result<Vec<String>, String> {
    let prefix = format!("{REMOTES}{name}/");
    let mut names = Vec::new();
    let platform = repo.references().map_err(|error| error.to_string())?;
    for reference in platform
        .remote_branches()
        .map_err(|error| error.to_string())?
    {
        let reference = reference.map_err(|error| error.to_string())?;
        let full = reference.name().as_bstr().to_str_lossy();
        if let Some(branch) = full.strip_prefix(&prefix)
            && branch != "HEAD"
        {
            names.push(branch.to_owned());
        }
    }
    names.sort();
    Ok(names)
}

/// The local branches (`refs/heads/…`), sorted.
pub fn local_branch_names(repo: &gix::Repository) -> Result<Vec<String>, String> {
    let mut names = Vec::new();
    let platform = repo.references().map_err(|error| error.to_string())?;
    for reference in platform
        .local_branches()
        .map_err(|error| error.to_string())?
    {
        let reference = reference.map_err(|error| error.to_string())?;
        let full = reference.name().as_bstr().to_str_lossy();
        if let Some(branch) = full.strip_prefix(HEADS) {
            names.push(branch.to_owned());
        }
    }
    names.sort();
    Ok(names)
}
