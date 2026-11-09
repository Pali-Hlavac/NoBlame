//! A conflicted file opened in an external merge tool through `git mergetool`, so the tool, its
//! command (`mergetool.<tool>.cmd`), `trustExitCode` and `keepBackup` behave as in a terminal.
//! The tool is always named: without `--tool`, git would guess one (even a terminal one such as
//! vimdiff, with no terminal). git waits until the tool is closed, then stages the file when the
//! merge worked (the tool said so, or the file changed).

use std::borrow::Cow;
use std::path::{Path, PathBuf};

use gix::bstr::BStr;
use tokio_util::sync::CancellationToken;

use super::OperationError;
use crate::cli::Git;

/// How a merge tool session ended.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum MergeToolOutcome {
    /// git staged the file: the conflict is resolved.
    Resolved,
    /// The tool was closed without resolving (the file unchanged, or the tool said it failed);
    /// the conflict stays.
    NotResolved {
        /// What git printed.
        output: String,
    },
}

/// The merge tool `git mergetool` would use (`merge.tool`), if one is set. Blocking.
pub fn configured_merge_tool(repo: &gix::Repository) -> Option<String> {
    repo.config_snapshot()
        .string("merge.tool")
        .map(|name| name.to_string())
        .filter(|name| !name.trim().is_empty())
}

/// Runs `git mergetool --no-prompt --tool=<tool>` on the conflicted `path` in `work_dir` and
/// waits until the tool is closed. A tool git cannot start is `Rejected`.
pub async fn run_merge_tool(
    git: &Git,
    work_dir: &Path,
    tool: &str,
    path: &[u8],
    cancel: &CancellationToken,
) -> Result<MergeToolOutcome, OperationError> {
    let file = os_path(BStr::new(path))?;
    let output = git
        .command()
        .current_dir(work_dir)
        .args(["mergetool", "--no-prompt"])
        .option("--tool", tool)
        .paths([file])
        .output(cancel)
        .await?;
    let text = output.combined();
    // git exits with 0 here too.
    if text.contains("No files need merging") {
        return Err(OperationError::NotApplicable(
            "This file has no conflict (any more).".to_owned(),
        ));
    }
    if output.success() {
        return Ok(MergeToolOutcome::Resolved);
    }
    // git names a tool it does not know, or one it could not run; everything else is a
    // session that ended without a resolution.
    if text.contains("cmd not set")
        || text.contains("Unknown merge tool")
        || text.contains("is not available")
        || text.contains("not found")
        || text.contains("cannot run")
    {
        return Err(OperationError::Rejected { output: text });
    }
    Ok(MergeToolOutcome::NotResolved { output: text })
}

fn os_path(path: &BStr) -> Result<PathBuf, OperationError> {
    gix::path::from_bstr(Cow::Borrowed(path))
        .map(Cow::into_owned)
        .map_err(|_| OperationError::NotApplicable(format!("{path} is not a valid path here.")))
}
