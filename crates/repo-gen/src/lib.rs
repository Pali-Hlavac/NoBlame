//! Deterministic synthetic Git repositories for tests and benchmarks.
//!
//! A simulated history (see [`Spec`]) is written as a `git fast-import` stream straight into
//! the user's `git`, which builds 1M commits in minutes. The same spec and seed always yield
//! the same commit ids, so benchmark numbers stay comparable between runs and machines.

mod history;
mod people;
mod rng;
mod spec;
mod stream;
mod tree;

use std::io::BufWriter;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

pub use history::Summary;
pub use spec::{DEFAULT_SEED, FILES_PER_DIR, Preset, Spec};

/// Environment variable that points at a specific git executable (shared with the app).
const GIT_OVERRIDE_ENV: &str = "NOBLAME_GIT";
/// Buffer between the generator and `git fast-import`.
const STREAM_BUFFER_BYTES: usize = 1 << 20;

/// Failure while generating a repository.
#[derive(Debug, thiserror::Error)]
pub enum GenError {
    /// The target directory exists and is not empty.
    #[error("{} already exists and is not empty", .0.display())]
    NotEmpty(PathBuf),
    /// A git command exited with an error.
    #[error("`git {command}` failed with {status}")]
    Git {
        /// The arguments of the failed command.
        command: String,
        /// Its exit status.
        status: std::process::ExitStatus,
    },
    /// Spawning git or writing the stream failed.
    #[error(transparent)]
    Io(#[from] std::io::Error),
}

/// Creates a new repository at `dir` (which must be missing or empty) with the history
/// described by `spec`, and checks out `main`.
pub fn generate(spec: &Spec, dir: &Path) -> Result<Summary, GenError> {
    if dir.exists() && dir.read_dir()?.next().is_some() {
        return Err(GenError::NotEmpty(dir.to_path_buf()));
    }
    std::fs::create_dir_all(dir)?;
    run_git(dir, &["init", "--quiet", "--initial-branch=main"])?;

    let mut child = git()
        .args(["fast-import", "--quiet", "--done"])
        .current_dir(dir)
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .spawn()?;
    let stdin = child
        .stdin
        .take()
        .ok_or_else(|| std::io::Error::other("no stdin pipe"))?;
    let mut stream = stream::Stream::new(BufWriter::with_capacity(STREAM_BUFFER_BYTES, stdin));
    let written = history::write_history(spec, &mut stream).and_then(|summary| {
        // Closing stdin tells fast-import the stream is complete.
        drop(stream.finish()?);
        Ok(summary)
    });
    let status = child.wait()?;
    let summary = written?;
    if !status.success() {
        return Err(GenError::Git {
            command: "fast-import".to_owned(),
            status,
        });
    }
    run_git(dir, &["reset", "--quiet", "--hard"])?;
    Ok(summary)
}

/// Writes the commit-graph file with changed-path Bloom filters, as a well-maintained large
/// repository would have.
pub fn write_commit_graph(dir: &Path) -> Result<(), GenError> {
    run_git(
        dir,
        &["commit-graph", "write", "--reachable", "--changed-paths"],
    )
}

fn git() -> Command {
    let program = std::env::var_os(GIT_OVERRIDE_ENV).unwrap_or_else(|| "git".into());
    let mut command = Command::new(program);
    // A fixed locale keeps messages stable; the generator never needs a terminal prompt.
    command.env("LC_ALL", "C").env("GIT_TERMINAL_PROMPT", "0");
    command
}

fn run_git(dir: &Path, args: &[&str]) -> Result<(), GenError> {
    let status = git().args(args).current_dir(dir).status()?;
    if status.success() {
        Ok(())
    } else {
        Err(GenError::Git {
            command: args.join(" "),
            status,
        })
    }
}
