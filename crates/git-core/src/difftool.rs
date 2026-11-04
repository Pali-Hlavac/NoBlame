//! A file's two versions opened in an external diff tool. Both run through
//! `git difftool --no-index -y`, so a tool git knows (`--tool`: `diff.tool`, `vscode`, a
//! `difftool.<tool>.cmd`) or a command of the user's own (`--extcmd`) starts as git would start
//! it. The tool is always named: without `--tool`, git would guess one (even a terminal one such
//! as vimdiff, with no terminal). Like git, NoBlame expects the tool to wait until it is closed.

use std::borrow::Cow;
use std::fs;
use std::path::{Path, PathBuf};

use gix::ObjectId;
use gix::bstr::{BStr, ByteSlice};
use tokio_util::sync::CancellationToken;

use crate::cli::{Git, GitError};

/// Hex digits naming a blob's folder, as in short commit ids.
const SHORT_ID_LENGTH: usize = 8;

/// Which program shows the diff.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DiffTool {
    /// A tool by its git name (`--tool`): one git knows (`vscode`, `meld`, `bc`) or one with a
    /// `difftool.<name>.cmd`.
    Tool(String),
    /// A shell command git runs with the old and the new file appended (`--extcmd`).
    Command(String),
}

/// One side of the diff.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Version {
    /// The file is absent on this side: an empty file stands in.
    Missing,
    /// A blob, written as a checkout would write it (smudge filters, line endings).
    Blob(ObjectId),
    /// The working tree file itself, so changes made in the tool are kept.
    WorkingTree,
}

/// Failures while opening a diff tool.
#[derive(Debug, thiserror::Error)]
pub enum DiffToolError {
    /// Neither `diff.tool` nor `merge.tool` is set.
    #[error("no diff tool is set in git (diff.tool)")]
    NotConfigured,
    /// The custom command is empty.
    #[error("the diff tool command is empty")]
    NoCommand,
    /// `git difftool` failed: the tool is unknown, not installed, or its command failed.
    #[error("{output}")]
    Failed {
        /// What git printed.
        output: String,
    },
    /// The path cannot be a file name on this system.
    #[error("{0} is not a valid path on this system")]
    InvalidPath(String),
    /// Writing a version failed.
    #[error("could not write {path}: {source}")]
    Write {
        /// The file.
        path: PathBuf,
        /// What the system reported.
        source: std::io::Error,
    },
    /// git failed (reading a blob, or `git difftool` itself, which prints why).
    #[error(transparent)]
    Git(#[from] GitError),
}

/// The tool `git difftool` would use: `diff.tool`, else `merge.tool` (as git falls back).
pub fn configured_tool(repo: &gix::Repository) -> Option<String> {
    let config = repo.config_snapshot();
    ["diff.tool", "merge.tool"]
        .into_iter()
        .find_map(|key| config.string(key))
        .map(|name| name.to_str_lossy().into_owned())
        .filter(|name| !name.trim().is_empty())
}

/// Writes the versions of `path` (`old_path` on the old side, for renames) into `folder`, each in
/// a folder named by its blob, and returns the files to open: old, then new.
pub async fn write_versions(
    git: &Git,
    work_dir: &Path,
    folder: &Path,
    (old_path, old): (&BStr, Version),
    (path, new): (&BStr, Version),
    cancel: &CancellationToken,
) -> Result<(PathBuf, PathBuf), DiffToolError> {
    let old = write_version(git, work_dir, folder, old_path, old, "old", cancel).await?;
    let new = write_version(git, work_dir, folder, path, new, "new", cancel).await?;
    Ok((old, new))
}

async fn write_version(
    git: &Git,
    work_dir: &Path,
    folder: &Path,
    path: &BStr,
    version: Version,
    side: &str,
    cancel: &CancellationToken,
) -> Result<PathBuf, DiffToolError> {
    let relative = os_path(path)?;
    if version == Version::WorkingTree {
        let file = work_dir.join(&relative);
        if file.is_file() {
            return Ok(file);
        }
    }
    let name = relative.file_name().map_or_else(
        || Cow::Borrowed(std::ffi::OsStr::new("file")),
        Cow::Borrowed,
    );
    let (subfolder, data) = match version {
        Version::Blob(id) => {
            let mut short = id.to_string();
            short.truncate(SHORT_ID_LENGTH);
            (
                short,
                checkout_bytes(git, work_dir, path, id, cancel).await?,
            )
        }
        // The `side` keeps both apart when neither has a blob.
        Version::Missing | Version::WorkingTree => (format!("{side} (none)"), Vec::new()),
    };
    let file = folder.join(subfolder).join(name);
    let failed = |source| DiffToolError::Write {
        path: file.clone(),
        source,
    };
    if let Some(parent) = file.parent() {
        fs::create_dir_all(parent).map_err(failed)?;
    }
    fs::write(&file, data).map_err(failed)?;
    Ok(file)
}

/// The bytes a checkout writes for blob `id` at `path` (`git cat-file --filters`).
async fn checkout_bytes(
    git: &Git,
    work_dir: &Path,
    path: &BStr,
    id: ObjectId,
    cancel: &CancellationToken,
) -> Result<Vec<u8>, DiffToolError> {
    let output = git
        .command()
        .current_dir(work_dir)
        .read_only()
        .args(["cat-file", "--filters"])
        .option("--path", os_path(path)?.as_os_str())
        .revision(&id.to_string())?
        .run(cancel)
        .await?;
    Ok(output.stdout)
}

/// Runs `git difftool --no-index -y` on the two files in `work_dir` (so the repository's
/// config applies) and waits until the tool is closed; returns what git and the tool printed.
pub async fn run_diff_tool(
    git: &Git,
    work_dir: &Path,
    tool: &DiffTool,
    old: &Path,
    new: &Path,
    cancel: &CancellationToken,
) -> Result<String, DiffToolError> {
    let command =
        git.command()
            .current_dir(work_dir)
            .args(["difftool", "--no-index", "--no-prompt"]);
    let command = match tool {
        DiffTool::Tool(name) => command.option("--tool", name),
        DiffTool::Command(line) if line.trim().is_empty() => return Err(DiffToolError::NoCommand),
        DiffTool::Command(line) => command.option("--extcmd", line),
    };
    let output = command.paths([old, new]).output(cancel).await?;
    // Like `git diff --no-index`, it exits with 1 when the files differ.
    match output.code {
        Some(0 | 1) => Ok(output.combined()),
        _ => Err(DiffToolError::Failed {
            output: output.stderr_lossy().trim().to_owned(),
        }),
    }
}

fn os_path(path: &BStr) -> Result<PathBuf, DiffToolError> {
    gix::path::from_bstr(Cow::Borrowed(path))
        .map(Cow::into_owned)
        .map_err(|_| DiffToolError::InvalidPath(path.to_string()))
}
