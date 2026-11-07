//! Checking a remote's name and URL before they reach git.

use gix::bstr::BStr;

use crate::branch::BranchError;

pub(super) const REMOTES: &str = "refs/remotes/";

/// Checks that `name` can be a remote's name, as git does (`refs/remotes/<name>/x` must be a
/// valid reference name), and that it does not start with `-`.
pub fn validate_remote_name(name: &str) -> Result<(), BranchError> {
    let invalid = |reason: &str| BranchError::InvalidName {
        name: name.to_owned(),
        reason: reason.to_owned(),
    };
    if name.is_empty() {
        return Err(invalid("it must not be empty"));
    }
    if name.starts_with('-') {
        return Err(invalid("it must not start with “-”"));
    }
    if name.chars().any(char::is_whitespace) {
        return Err(invalid("it must not contain spaces"));
    }
    let full = format!("{REMOTES}{name}/x");
    gix::validate::reference::name(BStr::new(full.as_bytes()))
        .map(|_| ())
        .map_err(|_| invalid("git does not allow it as a remote name (no “..”, “:”, “~”, “^”, “?”, “*”, “[”, “\\” or a “.” at the start of a part)"))
}

/// Checks that `url` can go to git as a remote's address: not empty, not an option, one line.
/// Anything else (https, ssh, a folder) is git's to judge.
pub fn validate_url(url: &str) -> Result<(), BranchError> {
    let reason = if url.trim().is_empty() {
        Some("it is empty")
    } else if url.starts_with('-') {
        Some("it must not start with “-”")
    } else if url.chars().any(char::is_control) {
        Some("it must be one line, without control characters")
    } else if url.trim() != url {
        Some("it must not start or end with a space")
    } else {
        None
    };
    match reason {
        Some(reason) => Err(BranchError::InvalidUrl {
            reason: reason.to_owned(),
        }),
        None => Ok(()),
    }
}
