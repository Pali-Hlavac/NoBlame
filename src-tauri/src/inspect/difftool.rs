//! "Open in diff tool": a file's two versions written to a temporary folder and shown by the
//! tool Settings name, through `git difftool --no-index`. The command returns once the tool has
//! had a moment to fail; the tool keeps running, and its folder is removed when it closes.

use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;

use git_core::cli::Git;
use git_core::diff::parse_object_id;
use git_core::difftool::{
    DiffTool, DiffToolError, Version, configured_tool, run_diff_tool, write_versions,
};
use serde::Deserialize;
use specta::Type;
use tokio_util::sync::CancellationToken;

use crate::git_env::GitEnvError;
use crate::repository::{RepoId, RepoSessions, RepositoryError, blocking};
use crate::settings::{ExternalDiffTool, ExternalDiffToolKind};

/// A tool that fails (unknown, not installed) does so within this time; one still running then
/// is taken as open.
const START_GRACE: Duration = Duration::from_millis(1500);
/// Folder under the system's temporary folder holding the versions shown.
const TEMP_FOLDER: &str = "noblame-difftool";
/// Git's name of Visual Studio Code (`code --wait --diff`).
const VS_CODE_TOOL: &str = "vscode";

/// Numbers each opened diff's folder.
static OPENED: AtomicU64 = AtomicU64::new(0);

/// The file whose diff is opened, as the diff tab shows it.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ExternalDiffRequestDto {
    /// Blob before the change (hex); `null` when the file is absent there.
    pub old_id: Option<String>,
    /// Blob after the change (hex); `null` when absent, ignored with `worktree`.
    pub new_id: Option<String>,
    /// The file's path (after a rename).
    pub path: String,
    /// The path before a rename or copy.
    pub old_path: Option<String>,
    /// The new side is the working tree file at `path`, opened itself (edits are kept).
    pub worktree: bool,
}

fn version(id: Option<&str>) -> Result<Version, RepositoryError> {
    Ok(match id {
        Some(hex) => Version::Blob(parse_object_id(hex)?),
        None => Version::Missing,
    })
}

/// Opens the request's file in the external diff tool `setting` names.
pub async fn open(
    sessions: &RepoSessions,
    id: RepoId,
    setting: ExternalDiffTool,
    request: ExternalDiffRequestDto,
) -> Result<(), RepositoryError> {
    let session = sessions.get(id)?;
    let info = session.repo.info();
    // A bare repository has no working tree; git still runs there, with its config.
    let dir = info
        .work_dir
        .clone()
        .unwrap_or_else(|| info.git_dir.clone());
    let tool = match setting.kind {
        ExternalDiffToolKind::Git => {
            let repo = session.repo.clone();
            let name = blocking(move || configured_tool(&repo.local())).await?;
            DiffTool::Tool(name.ok_or(DiffToolError::NotConfigured)?)
        }
        ExternalDiffToolKind::VsCode => DiffTool::Tool(VS_CODE_TOOL.to_owned()),
        ExternalDiffToolKind::Custom => DiffTool::Command(setting.command),
    };
    let old = version(request.old_id.as_deref())?;
    let new = if request.worktree {
        Version::WorkingTree
    } else {
        version(request.new_id.as_deref())?
    };
    let old_path = request.old_path.as_deref().unwrap_or(&request.path);
    let run = OPENED.fetch_add(1, Ordering::Relaxed);
    let folder = std::env::temp_dir()
        .join(TEMP_FOLDER)
        .join(format!("{}-{run}", std::process::id()));
    let git = Git::locate().map_err(GitEnvError::from)?;
    let (old, new) = write_versions(
        &git,
        &dir,
        &folder,
        (old_path.into(), old),
        (request.path.as_str().into(), new),
        &CancellationToken::new(),
    )
    .await?;
    let mut running = tokio::spawn(async move {
        let result = run_diff_tool(&git, &dir, &tool, &old, &new, &CancellationToken::new()).await;
        remove(&folder);
        result
    });
    match tokio::time::timeout(START_GRACE, &mut running).await {
        Ok(finished) => {
            finished.map_err(|error| RepositoryError::Task(error.to_string()))??;
        }
        Err(_) => {
            // Still open; a later failure can only be logged.
            tokio::spawn(async move {
                if let Ok(Err(error)) = running.await {
                    tracing::warn!(%error, "the external diff tool failed");
                }
            });
        }
    }
    Ok(())
}

/// Deletes the versions written for a closed tool.
fn remove(folder: &Path) {
    if let Err(error) = std::fs::remove_dir_all(folder)
        && error.kind() != std::io::ErrorKind::NotFound
    {
        tracing::warn!(folder = %folder.display(), %error, "could not delete the diff tool's files");
    }
}
