//! Initializing and updating submodules: `git submodule update --init --recursive`, run as a
//! background job (it may clone). git honours each submodule's `update` setting (checkout,
//! rebase, merge or none); local changes in the way make it refuse.

use std::path::Path;

use crate::cli::{Git, GitCommand};
use crate::remote::clone_hint;

/// `git submodule update --init --recursive --progress [-- <paths>]` in `work_dir`: the
/// submodules at `paths` (relative to `work_dir`, `/` separators), or all of them when empty.
/// Not yet cloned ones are cloned, nested ones too. Run it with
/// [`GitCommand::stream`](crate::cli::GitCommand::stream).
pub fn update_command(git: &Git, work_dir: &Path, paths: &[String]) -> GitCommand {
    let command = git
        .command()
        .current_dir(work_dir)
        .literal_pathspecs()
        .args(["submodule", "update", "--init", "--recursive", "--progress"]);
    if paths.is_empty() {
        command
    } else {
        command.paths(paths)
    }
}

/// `git submodule update --recursive --progress` in `work_dir`: every submodule already set up
/// is moved to the commit the repository records (after a checkout); none is cloned. Run it
/// with [`GitCommand::stream`](crate::cli::GitCommand::stream).
pub fn follow_command(git: &Git, work_dir: &Path) -> GitCommand {
    git.command()
        .current_dir(work_dir)
        .args(["submodule", "update", "--recursive", "--progress"])
}

/// How many submodules an update moved, from git's output (`Submodule path 'x': checked out
/// '<id>'`, also `rebased into` and `merged in`).
pub fn updated_count(output: &str) -> usize {
    output
        .lines()
        .filter(|line| {
            line.starts_with("Submodule path '")
                && ["': checked out '", "': rebased into '", "': merged in '"]
                    .iter()
                    .any(|what| line.contains(what))
        })
        .count()
}

/// A next step in plain words for a failed submodule update, from git's output.
pub fn submodule_hint(output: &str) -> Option<&'static str> {
    let hints: &[(&str, &str)] = &[
        (
            "transport 'file' not allowed",
            "Git does not clone submodules from a folder on this computer unless your Git \
             configuration allows it (protocol.file.allow).",
        ),
        (
            "would be overwritten",
            "The submodule has uncommitted changes in the way. Commit or stash them in the \
             submodule first.",
        ),
        (
            "already exists and is not an empty directory",
            "The submodule's folder already has files in it. Move them away, then try again.",
        ),
        (
            "not our ref",
            "The submodule's server does not have the commit this repository records: it may \
             not have been pushed yet.",
        ),
        (
            "but it did not contain",
            "The submodule's server does not have the commit this repository records: it may \
             not have been pushed yet.",
        ),
    ];
    hints
        .iter()
        .find(|(needle, _)| output.contains(needle))
        .map(|(_, hint)| *hint)
        .or_else(|| clone_hint(output))
}

#[cfg(test)]
mod tests {
    use super::{submodule_hint, updated_count};

    #[test]
    fn counts_the_submodules_moved() {
        let output = "Cloning into 'x'...\n\
                      Submodule path 'deps/a': checked out '0123'\n\
                      Submodule path 'deps/b': rebased into '4567'\n\
                      Submodule 'c' (url) registered for path 'c'\n";
        assert_eq!(updated_count(output), 2);
        assert_eq!(updated_count(""), 0);
    }

    #[test]
    fn hints_name_the_reason() {
        assert!(
            submodule_hint("fatal: transport 'file' not allowed")
                .is_some_and(|hint| hint.contains("protocol.file.allow"))
        );
        assert!(
            submodule_hint("Could not resolve host: example.com")
                .is_some_and(|hint| hint.contains("server's name"))
        );
        assert_eq!(submodule_hint("something else"), None);
    }
}
