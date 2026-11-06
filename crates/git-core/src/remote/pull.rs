//! `git pull`: the command line for a pull job, what it did, and what to do when git refused.

use std::path::Path;

use crate::cli::{Git, GitCommand};

/// How a pull joins the upstream's commits with the branch's own.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PullMode {
    /// What the user's config says (`pull.rebase`, `pull.ff`).
    Default,
    /// Merge (`--no-rebase`), fast-forwarding when possible unless `pull.ff=false`.
    Merge,
    /// Rebase the branch's own commits onto the upstream (`--rebase`).
    Rebase,
    /// Only fast-forward; refuse when both sides have new commits (`--ff-only`).
    FastForwardOnly,
}

/// `git pull --progress --no-edit [mode]` in `work_dir`: the current branch from its upstream.
/// `--no-edit` keeps git from opening an editor for a merge message (there is no terminal).
pub fn pull_command(git: &Git, work_dir: &Path, mode: PullMode) -> GitCommand {
    let command = git
        .command()
        .current_dir(work_dir)
        .args(["pull", "--progress", "--no-edit"]);
    match mode {
        PullMode::Default => command,
        PullMode::Merge => command.arg("--no-rebase"),
        PullMode::Rebase => command.arg("--rebase"),
        PullMode::FastForwardOnly => command.arg("--ff-only"),
    }
}

/// What a successful pull did, from its output: `Fast-forwarded: 3 files changed, …`,
/// `Merged`, `Rebased`, `Already up to date`.
pub fn describe_pull(stdout: &str, stderr: &str) -> String {
    let text = format!("{stdout}\n{stderr}");
    let what = if text.contains("Already up to date") || text.contains("Current branch") {
        return "Already up to date".to_owned();
    } else if text.contains("Successfully rebased") {
        "Rebased"
    } else if text.contains("Fast-forward") {
        "Fast-forwarded"
    } else if text.contains("Merge made by") {
        "Merged"
    } else {
        "Pulled"
    };
    match text.lines().find(|line| line.contains(" changed")) {
        Some(stat) => format!("{what}: {}", stat.trim()),
        None => what.to_owned(),
    }
}

/// A plain-language next step for a failed pull, when git's output shows a known reason.
pub fn pull_hint(output: &str) -> Option<&'static str> {
    let hints = [
        (
            "reconcile divergent branches",
            "Your branch and its upstream both have new commits. Choose Pull ▾ → Merge or Rebase.",
        ),
        (
            "Not possible to fast-forward",
            "Your branch and its upstream both have new commits. Pull with Merge or Rebase instead.",
        ),
        (
            "CONFLICT",
            "Some changes conflict. Resolve the files, then commit the merge or continue the rebase \
             (`git rebase --continue`) in a terminal; NoBlame's conflict tools arrive in M6.",
        ),
        (
            "no tracking information",
            "This branch has no upstream. Set one in the Branches module (Set upstream…).",
        ),
        (
            "would be overwritten",
            "Your uncommitted changes are in the way. Commit or stash them first.",
        ),
        (
            "not currently on a branch",
            "You are not on a branch (detached HEAD). Check out a branch first.",
        ),
        (
            "unstaged changes",
            "Rebasing needs a clean working tree. Commit or stash your changes first.",
        ),
    ];
    hints
        .iter()
        .find(|(needle, _)| output.contains(needle))
        .map(|(_, hint)| *hint)
}

#[cfg(test)]
mod tests {
    use super::{describe_pull, pull_hint};

    #[test]
    fn describes_what_a_pull_did() {
        assert_eq!(
            describe_pull("Already up to date.\n", ""),
            "Already up to date"
        );
        assert_eq!(
            describe_pull(
                "Updating 1a2b..3c4d\nFast-forward\n a.txt | 2 +-\n 1 file changed, 1 insertion(+), 1 deletion(-)\n",
                ""
            ),
            "Fast-forwarded: 1 file changed, 1 insertion(+), 1 deletion(-)"
        );
        assert_eq!(
            describe_pull("", "Successfully rebased and updated refs/heads/main.\n"),
            "Rebased"
        );
        assert_eq!(
            describe_pull(
                "Merge made by the 'ort' strategy.\n b.txt | 1 +\n 1 file changed, 1 insertion(+)\n",
                ""
            ),
            "Merged: 1 file changed, 1 insertion(+)"
        );
    }

    #[test]
    fn explains_common_refusals() {
        assert!(
            pull_hint("fatal: Need to specify how to reconcile divergent branches.")
                .is_some_and(|hint| hint.contains("Merge or Rebase"))
        );
        assert!(pull_hint("CONFLICT (content): Merge conflict in a.txt").is_some());
        assert_eq!(pull_hint("fatal: unable to access"), None);
    }
}
