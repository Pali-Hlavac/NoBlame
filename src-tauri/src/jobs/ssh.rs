//! A job talking to a remote with an SSH key chosen in the remote editor gets
//! `GIT_SSH_COMMAND` (`crate::ssh_keys`). When git picks the remote (Fetch, Pull), it is the
//! current branch's remote, else `origin`, as git decides.

use git_core::cli::GitCommand;

use super::registry::JobRegistry;
use super::target::JobTarget;
use crate::ssh_keys::{key_for, ssh_command};

const SSH_COMMAND_ENV: &str = "GIT_SSH_COMMAND";
const DEFAULT_REMOTE: &str = "origin";

/// `command` with the key chosen for `remote`, if one is.
pub fn with_key(
    command: GitCommand,
    registry: &JobRegistry,
    target: &JobTarget,
    remote: &str,
) -> GitCommand {
    let Some(key) = registry
        .ssh_keys()
        .and_then(|store| key_for(&store, &target.dir, remote))
    else {
        return command;
    };
    // What git would run otherwise: the environment's, then the repository's setting.
    let base = std::env::var(SSH_COMMAND_ENV).ok().or_else(|| {
        let repo = target.repo.local();
        repo.config_snapshot()
            .string("core.sshCommand")
            .map(|value| value.to_string())
    });
    command.env(SSH_COMMAND_ENV, ssh_command(&key, base.as_deref()))
}

/// The remote git uses when none is named: the current branch's, else `origin`.
pub fn default_remote(target: &JobTarget) -> String {
    let repo = target.repo.local();
    let branch = repo
        .head_name()
        .ok()
        .flatten()
        .map(|name| name.shorten().to_string());
    branch
        .and_then(|branch| {
            repo.config_snapshot()
                .string(format!("branch.{branch}.remote").as_str())
                .map(|value| value.to_string())
        })
        .unwrap_or_else(|| DEFAULT_REMOTE.to_owned())
}
