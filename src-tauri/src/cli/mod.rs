//! The `noblame` command line (ADR 0015, `docs/architecture/cli-and-windows.md`).
//!
//! `noblame [PATH]` opens the main window (with `PATH` as a repository tab);
//! `noblame <TASK> [PATH]` opens a focused task window. The same parser handles the first
//! launch and the arguments a second launch forwards to the running instance.

mod console;
mod task;

use std::ffi::OsString;
use std::path::{Path, PathBuf};

use clap::{Arg, ArgMatches, Command, value_parser};

pub use console::attach_parent_console;
pub use task::TaskKind;

/// Executable name shown in help and usage messages.
const BIN_NAME: &str = "noblame";
/// Name of the positional path argument.
const PATH_ARG: &str = "path";
/// Subcommand that opens the main window, like running `noblame` without a task.
const BROWSE_COMMAND: &str = "browse";

/// Which window a command line asks for.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LaunchTarget {
    /// The main window.
    Main,
    /// A focused task window.
    Task(TaskKind),
}

/// A parsed command line. Paths are absolute (resolved against the caller's directory).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LaunchRequest {
    /// Which window to open.
    pub target: LaunchTarget,
    /// Repository, folder or file the window is about.
    pub path: Option<PathBuf>,
}

/// The clap definition of the whole command line.
pub fn command() -> Command {
    let mut command = Command::new(BIN_NAME)
        // Keep usage lines stable (`noblame`, not `noblame.exe` or a full path).
        .bin_name(BIN_NAME)
        .version(env!("CARGO_PKG_VERSION"))
        .about("NoBlame, a fast Git client for giant repositories")
        .arg(path_arg("Repository to open in the main window"))
        .args_conflicts_with_subcommands(true)
        .subcommand(
            Command::new(BROWSE_COMMAND)
                .about("Open the main window, optionally with a repository")
                .arg(path_arg("Repository to open")),
        );
    for task in TaskKind::ALL {
        command = command.subcommand(
            Command::new(task.command_name())
                .about(task.about())
                .arg(path_arg(task.path_help())),
        );
    }
    command
}

/// Parses `args` (including the program name) and resolves paths against `cwd`.
pub fn parse<I, T>(args: I, cwd: &Path) -> Result<LaunchRequest, clap::Error>
where
    I: IntoIterator<Item = T>,
    T: Into<OsString> + Clone,
{
    let matches = command().try_get_matches_from(args)?;
    let request = match matches.subcommand() {
        Some((name, sub)) => match TaskKind::from_command_name(name) {
            // Task windows always need a target; default to where the command was run.
            Some(task) => LaunchRequest {
                target: LaunchTarget::Task(task),
                path: Some(path_of(sub, cwd).unwrap_or_else(|| cwd.to_path_buf())),
            },
            None => main_request(sub, cwd),
        },
        None => main_request(&matches, cwd),
    };
    Ok(request)
}

fn main_request(matches: &ArgMatches, cwd: &Path) -> LaunchRequest {
    LaunchRequest {
        target: LaunchTarget::Main,
        path: path_of(matches, cwd),
    }
}

fn path_arg(help: &'static str) -> Arg {
    Arg::new(PATH_ARG)
        .help(help)
        .value_parser(value_parser!(PathBuf))
}

fn path_of(matches: &ArgMatches, cwd: &Path) -> Option<PathBuf> {
    matches
        .get_one::<PathBuf>(PATH_ARG)
        .map(|path| absolute(&cwd.join(path)))
}

/// Normalizes without touching the file system: drops `.` components (so `noblame .` is not
/// shown as "."), and on Windows also resolves `..` and turns `/` into `\`. Symlinks are kept,
/// as the user named them.
fn absolute(path: &Path) -> PathBuf {
    std::path::absolute(path).unwrap_or_else(|_| path.to_path_buf())
}

#[cfg(test)]
mod tests;
