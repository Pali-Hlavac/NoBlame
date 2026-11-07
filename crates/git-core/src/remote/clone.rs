//! `git clone` for a background job: checking where it goes first, the command line for the
//! clone dialog's options, a next step for common refusals, and removing what a cancelled clone
//! left behind (git cleans up after its own failures, but a killed git cannot).

use std::ffi::OsStr;
use std::path::{Path, PathBuf};
use std::{fs, io};

use crate::branch::{BranchError, RefNamespace, validate_name};
use crate::cli::{Git, GitCommand, GitError};

use super::validate::validate_url;

/// How much of the history's contents a clone downloads up front.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CloneFilter {
    /// Everything (a normal clone).
    None,
    /// No file contents until a checkout or diff needs them (`--filter=blob:none`).
    Blobless,
    /// No folders or file contents of old commits until needed (`--filter=tree:0`).
    Treeless,
}

/// What the clone dialog asks for.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CloneOptions {
    /// The repository's address (https, ssh, a folder).
    pub url: String,
    /// The branch (or tag) to check out instead of the remote's default (`--branch`).
    pub branch: Option<String>,
    /// Only the newest commits (`--depth`): a shallow clone.
    pub depth: Option<u32>,
    /// Only the branch checked out (`--single-branch`).
    pub single_branch: bool,
    /// What to leave on the server until needed (a partial clone).
    pub filter: CloneFilter,
    /// Clone the submodules too (`--recurse-submodules`).
    pub recurse_submodules: bool,
}

/// Failures before git runs, and while cleaning up.
#[derive(Debug, thiserror::Error)]
pub enum CloneError {
    /// The URL or the branch name cannot be used.
    #[error(transparent)]
    Invalid(#[from] BranchError),
    /// The folder is not given as a full path.
    #[error("{} is not a full path", .0.display())]
    Relative(PathBuf),
    /// The folder exists and holds files: git refuses to clone into it.
    #[error("{} is not empty", .0.display())]
    NotEmpty(PathBuf),
    /// The path is a file.
    #[error("{} is a file", .0.display())]
    NotAFolder(PathBuf),
    /// Reading or removing the folder failed.
    #[error("{}: {source}", path.display())]
    Io {
        /// What was read or removed.
        path: PathBuf,
        /// Why it failed.
        source: io::Error,
    },
    /// git could not run.
    #[error(transparent)]
    Git(#[from] GitError),
}

/// Where a clone goes, checked: a new folder, or an empty one.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CloneTarget {
    /// The folder the repository is cloned into.
    pub folder: PathBuf,
    /// Whether it existed (empty) before the clone.
    pub existed: bool,
    /// Where git runs: the nearest folder above it that exists (git creates the rest).
    pub run_in: PathBuf,
}

/// Checks that `folder` is a full path that does not exist or is an empty folder.
pub fn check_clone_target(folder: &Path) -> Result<CloneTarget, CloneError> {
    if !folder.is_absolute() {
        return Err(CloneError::Relative(folder.to_owned()));
    }
    let io_error = |source| CloneError::Io {
        path: folder.to_owned(),
        source,
    };
    let existed = match fs::metadata(folder) {
        Ok(metadata) if !metadata.is_dir() => {
            return Err(CloneError::NotAFolder(folder.to_owned()));
        }
        Ok(_) => {
            if fs::read_dir(folder).map_err(io_error)?.next().is_some() {
                return Err(CloneError::NotEmpty(folder.to_owned()));
            }
            true
        }
        Err(error) if error.kind() == io::ErrorKind::NotFound => false,
        Err(error) => return Err(io_error(error)),
    };
    let run_in = folder
        .ancestors()
        .skip(1)
        .find(|ancestor| ancestor.is_dir())
        .ok_or_else(|| io_error(io::Error::from(io::ErrorKind::NotFound)))?
        .to_owned();
    Ok(CloneTarget {
        folder: folder.to_owned(),
        existed,
        run_in,
    })
}

/// `git clone --progress [options] -- <url> <folder>`, run where `target` says. Run it with
/// [`GitCommand::stream`](crate::cli::GitCommand::stream).
pub fn clone_command(
    git: &Git,
    target: &CloneTarget,
    options: &CloneOptions,
) -> Result<GitCommand, CloneError> {
    validate_url(&options.url)?;
    let mut command = git
        .command()
        .current_dir(&target.run_in)
        .args(["clone", "--progress"]);
    if let Some(branch) = &options.branch {
        validate_name(RefNamespace::Branch, branch)?;
        command = command.option("--branch", branch);
    }
    if let Some(depth) = options.depth {
        command = command.option("--depth", depth.max(1).to_string());
    }
    if options.single_branch {
        command = command.arg("--single-branch");
    }
    match options.filter {
        CloneFilter::None => {}
        CloneFilter::Blobless => command = command.arg("--filter=blob:none"),
        CloneFilter::Treeless => command = command.arg("--filter=tree:0"),
    }
    if options.recurse_submodules {
        command = command.arg("--recurse-submodules");
    }
    Ok(command.operands([OsStr::new(&options.url), target.folder.as_os_str()]))
}

/// Removes what a cancelled clone wrote: the folder it made, or the contents of the empty
/// folder it was given.
pub fn remove_partial_clone(target: &CloneTarget) -> Result<(), CloneError> {
    let io_error = |path: &Path| {
        let path = path.to_owned();
        move |source| CloneError::Io { path, source }
    };
    if !target.existed {
        return match fs::remove_dir_all(&target.folder) {
            Err(error) if error.kind() != io::ErrorKind::NotFound => {
                Err(io_error(&target.folder)(error))
            }
            _ => Ok(()),
        };
    }
    for entry in fs::read_dir(&target.folder).map_err(io_error(&target.folder))? {
        let path = entry.map_err(io_error(&target.folder))?.path();
        let removed = if path.is_dir() {
            fs::remove_dir_all(&path)
        } else {
            fs::remove_file(&path)
        };
        removed.map_err(io_error(&path))?;
    }
    Ok(())
}

/// A next step in plain words for a failed clone, from git's output.
pub fn clone_hint(output: &str) -> Option<&'static str> {
    let hints: &[(&str, &str)] = &[
        (
            "not found in upstream",
            "That branch does not exist there. Leave Branch empty to check out the default one.",
        ),
        (
            "Authentication failed",
            "The server did not accept your credentials. Check your user name and password or token.",
        ),
        (
            "Permission denied (publickey",
            "The server did not accept your SSH key. Check that it is added to your account and to your SSH agent.",
        ),
        (
            "Could not resolve host",
            "The server's name could not be found. Check the URL and your network.",
        ),
        (
            "not found",
            "There is no repository at this URL, or you may not see it. Check the URL.",
        ),
        (
            "does not appear to be a git repository",
            "There is no repository at this URL. Check the URL.",
        ),
        (
            "already exists and is not an empty directory",
            "Choose a new folder, or an empty one.",
        ),
    ];
    hints
        .iter()
        .find(|(needle, _)| output.contains(needle))
        .map(|(_, hint)| *hint)
}

#[cfg(test)]
mod tests {
    use super::clone_hint;

    #[test]
    fn explains_common_refusals() {
        assert!(
            clone_hint("warning: Could not find remote branch x to clone.\nfatal: Remote branch x not found in upstream origin")
                .is_some_and(|hint| hint.contains("Leave Branch empty"))
        );
        assert!(
            clone_hint("remote: Repository not found.\nfatal: repository 'https://x/y/' not found")
                .is_some_and(|hint| hint.contains("Check the URL"))
        );
        assert_eq!(clone_hint("fatal: early EOF"), None);
    }
}
