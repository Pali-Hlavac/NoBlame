//! `git fetch`: the command line for a fetch job and a summary of what it changed.

use std::path::Path;

use crate::cli::{Git, GitCommand, GitError};

/// Which remotes to fetch from.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum FetchTarget {
    /// What plain `git fetch` picks: the current branch's remote, else `origin`.
    Default,
    /// Every remote (`--all`).
    All,
    /// One remote by name.
    Remote(String),
}

/// A fetch to run.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FetchOptions {
    /// Where from.
    pub target: FetchTarget,
    /// Remove remote branches that are gone on the remote (`--prune`).
    pub prune: bool,
}

/// The command for `options`, with `--progress` so a job can show how far it got (git
/// prints progress only to a terminal otherwise). Run it with
/// [`GitCommand::stream`](crate::cli::GitCommand::stream).
pub fn fetch_command(
    git: &Git,
    dir: &Path,
    options: &FetchOptions,
) -> Result<GitCommand, GitError> {
    let mut command = git.command().current_dir(dir).args(["fetch", "--progress"]);
    if options.prune {
        command = command.arg("--prune");
    }
    match &options.target {
        FetchTarget::Default => {}
        FetchTarget::All => command = command.arg("--all"),
        FetchTarget::Remote(name) => command = command.revision(name)?,
    }
    Ok(command)
}

/// What a fetch changed, counted from git's reference update lines.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct FetchSummary {
    /// New branches and tags.
    pub new: u32,
    /// Branches and tags that moved (forced or not).
    pub updated: u32,
    /// Remote branches removed by `--prune`.
    pub pruned: u32,
    /// Updates git refused (`! [rejected]`).
    pub rejected: u32,
}

impl FetchSummary {
    /// True when nothing changed.
    pub fn is_empty(self) -> bool {
        self.new + self.updated + self.pruned + self.rejected == 0
    }
}

/// Counts the update lines in a fetch's standard error: ` <flag> <summary> <from> -> <to>`,
/// where the flag is `*` (new), `-` (pruned), `!` (rejected), or ` `, `+`, `t` (updated).
pub fn summarize_fetch(stderr: &str) -> FetchSummary {
    let mut summary = FetchSummary::default();
    for line in stderr.lines() {
        let mut chars = line.chars();
        if chars.next() != Some(' ') || !line.contains(" -> ") {
            continue;
        }
        match chars.next() {
            Some('*') => summary.new += 1,
            Some('-') => summary.pruned += 1,
            Some('!') => summary.rejected += 1,
            Some('=') => {}
            _ => summary.updated += 1,
        }
    }
    summary
}

#[cfg(test)]
mod tests {
    use super::{FetchSummary, summarize_fetch};

    #[test]
    fn counts_reference_updates() {
        let stderr = "From https://example.com/repo\n\
             \x20  1a2b3c4..5d6e7f8  main       -> origin/main\n\
             \x20+ 1a2b3c4...9f8e7d6 wip      -> origin/wip  (forced update)\n\
             \x20* [new branch]      topic      -> origin/topic\n\
             \x20* [new tag]         v1.0       -> v1.0\n\
             \x20- [deleted]         (none)     -> origin/old\n\
             \x20! [rejected]        v0.9       -> v0.9  (would clobber existing tag)\n\
             Receiving objects: 100% (3/3), done.\n";
        assert_eq!(
            summarize_fetch(stderr),
            FetchSummary {
                new: 2,
                updated: 2,
                pruned: 1,
                rejected: 1,
            }
        );
        assert!(summarize_fetch("").is_empty());
    }
}
