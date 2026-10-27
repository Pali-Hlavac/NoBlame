//! The tasks that can be opened as their own window (`noblame commit <path>`, ...).

use serde::{Deserialize, Serialize};
use specta::Type;

/// A focused task window. Also the list of `noblame` subcommands (ADR 0015).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum TaskKind {
    /// Commit graph and history.
    Log,
    /// Stage changes and commit.
    Commit,
    /// Working tree changes.
    Diff,
    /// Line-by-line authorship of a file.
    Blame,
    /// History of one file.
    FileHistory,
    /// Pull from a remote.
    Pull,
    /// Push to a remote.
    Push,
    /// Fetch from remotes.
    Fetch,
    /// Switch branches.
    Switch,
    /// Merge a branch.
    Merge,
    /// Rebase the current branch.
    Rebase,
    /// Save or restore stashed changes.
    Stash,
    /// Clone a repository.
    Clone,
    /// Create a repository.
    Init,
}

impl TaskKind {
    /// Every task, in the order `--help` lists them.
    pub const ALL: [Self; 14] = [
        Self::Log,
        Self::Commit,
        Self::Diff,
        Self::Blame,
        Self::FileHistory,
        Self::Pull,
        Self::Push,
        Self::Fetch,
        Self::Switch,
        Self::Merge,
        Self::Rebase,
        Self::Stash,
        Self::Clone,
        Self::Init,
    ];

    /// Subcommand name on the command line.
    pub fn command_name(self) -> &'static str {
        match self {
            Self::Log => "log",
            Self::Commit => "commit",
            Self::Diff => "diff",
            Self::Blame => "blame",
            Self::FileHistory => "filehistory",
            Self::Pull => "pull",
            Self::Push => "push",
            Self::Fetch => "fetch",
            Self::Switch => "switch",
            Self::Merge => "merge",
            Self::Rebase => "rebase",
            Self::Stash => "stash",
            Self::Clone => "clone",
            Self::Init => "init",
        }
    }

    /// Window title prefix.
    pub fn title(self) -> &'static str {
        match self {
            Self::Log => "Log",
            Self::Commit => "Commit",
            Self::Diff => "Diff",
            Self::Blame => "Blame",
            Self::FileHistory => "File history",
            Self::Pull => "Pull",
            Self::Push => "Push",
            Self::Fetch => "Fetch",
            Self::Switch => "Switch branch",
            Self::Merge => "Merge",
            Self::Rebase => "Rebase",
            Self::Stash => "Stash",
            Self::Clone => "Clone",
            Self::Init => "Create repository",
        }
    }

    /// One-line description for `--help`.
    pub fn about(self) -> &'static str {
        match self {
            Self::Log => "Show the commit graph of a repository or the history of a folder",
            Self::Commit => "Stage changes and commit them",
            Self::Diff => "Show the changes in the working tree",
            Self::Blame => "Show who last changed each line of a file",
            Self::FileHistory => "Show the history of a file",
            Self::Pull => "Fetch and integrate changes from a remote",
            Self::Push => "Push commits to a remote",
            Self::Fetch => "Download objects and refs from remotes",
            Self::Switch => "Switch to another branch",
            Self::Merge => "Merge a branch into the current branch",
            Self::Rebase => "Rebase the current branch",
            Self::Stash => "Stash changes or restore stashed changes",
            Self::Clone => "Clone a repository into a folder",
            Self::Init => "Create a new repository in a folder",
        }
    }

    /// The task whose [`command_name`](Self::command_name) is `name`.
    pub fn from_command_name(name: &str) -> Option<Self> {
        Self::ALL
            .into_iter()
            .find(|task| task.command_name() == name)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn command_names_round_trip_and_are_unique() {
        for task in TaskKind::ALL {
            assert_eq!(TaskKind::from_command_name(task.command_name()), Some(task));
        }
        let mut names: Vec<_> = TaskKind::ALL
            .iter()
            .map(|task| task.command_name())
            .collect();
        names.sort_unstable();
        names.dedup();
        assert_eq!(names.len(), TaskKind::ALL.len());
    }
}
