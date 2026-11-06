//! Creating and deleting tags with `git tag`.

use std::path::Path;

use tokio_util::sync::CancellationToken;

use super::{BranchError, RefNamespace, accepted, validate_name};
use crate::cli::Git;

/// Creates the tag `name` on `target`. With a message it is annotated (`--annotate`, the message
/// read from standard input, so any text is safe); without one it is lightweight. git signs it
/// when `tag.gpgSign` says so.
pub async fn create_tag(
    git: &Git,
    dir: &Path,
    name: &str,
    target: &str,
    message: Option<&str>,
    cancel: &CancellationToken,
) -> Result<String, BranchError> {
    validate_name(RefNamespace::Tag, name)?;
    let mut command = git.command().current_dir(dir).arg("tag");
    if let Some(message) = message.map(str::trim).filter(|message| !message.is_empty()) {
        command = command
            .args(["--annotate", "--file=-"])
            .stdin(format!("{message}\n"));
    }
    let command = command.revision(name)?.revision(target)?;
    accepted(&command.output(cancel).await?)
}

/// Deletes the tag `name` here (`git tag --delete`); a copy pushed to a remote stays there.
/// Check it first with [`check_ref`](super::check_ref).
pub async fn delete_tag(
    git: &Git,
    dir: &Path,
    name: &str,
    cancel: &CancellationToken,
) -> Result<String, BranchError> {
    let command = git
        .command()
        .current_dir(dir)
        .args(["tag", "--delete"])
        .revision(name)?;
    accepted(&command.output(cancel).await?)
}
