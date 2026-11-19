//! The remote editor's backend: a remote's settings of every scope (secrets hidden), the
//! commands a set of changes would run, and saving them all or nothing under the session's
//! write lock. Read afresh each time, like the remotes list: the session's copy of the config
//! is as it was when the repository opened. See `docs/features/remotes.md`.

use std::path::{Path, PathBuf};

use git_core::cli::Git;
use git_core::config::{PlanError, ScopedEntry, read_all_scopes};
use git_core::lfs::uses_lfs;
use git_core::remote::{
    RemoteEdit, RemoteEditPlan, apply_remote_edit, describe_remote_edit, local_branch_names,
    plan_remote_edit, remote_branch_names, remote_head,
};
use git_core::repo::Repository;
use tokio_util::sync::CancellationToken;

use super::remote_settings_types::{ConfigValueDto, RemoteEditDto, RemoteSettingsDto};
use super::remote_ssh;
use super::service::{git, git_dir_or_work_tree};
use crate::error::{AppError, ErrorCode};
use crate::git_config::config_error;
use crate::repository::{RepoId, RepoSessions, RepositoryError, blocking};
use crate::ssh_keys::SshKeysStore;

/// The sections the editor shows; the rest of the config (user, aliases, signing keys) stays
/// in the backend.
const SECTIONS: [&str; 9] = [
    "remote.",
    "url.",
    "branch.",
    "push.",
    "pull.",
    "fetch.",
    "http.",
    "credential.",
    "lfs.",
];

fn shown(entry: &ScopedEntry) -> bool {
    SECTIONS
        .iter()
        .any(|section| entry.key.starts_with(section))
}

/// A planning or saving failure as the window shows it.
pub(super) fn plan_error(error: PlanError) -> AppError {
    match error {
        PlanError::Config(error) => config_error(error),
        error @ PlanError::Changed { .. } => {
            AppError::new(ErrorCode::InvalidData, error.to_string()).with_hint(
                "Another program changed the settings. Discard your changes to see them.",
            )
        }
        error @ PlanError::HiddenValue { .. } => {
            AppError::new(ErrorCode::InvalidInput, error.to_string())
        }
        error @ PlanError::Failed { .. } => AppError::new(ErrorCode::GitFailed, error.to_string()),
    }
}

/// What the editor reads from the refs, afresh.
struct Refs {
    head: Option<String>,
    branches: Vec<String>,
    local_branches: Vec<String>,
    uses_lfs: bool,
}

/// The default branch and remote branches of `name`, and the local branches, read afresh.
async fn refs(dir: PathBuf, name: String) -> Result<Refs, AppError> {
    blocking(move || -> Result<Refs, AppError> {
        let repo = Repository::discover(&dir)
            .map_err(RepositoryError::from)?
            .local();
        let internal = |message| AppError::new(ErrorCode::Internal, message);
        Ok(Refs {
            uses_lfs: uses_lfs(repo.common_dir(), repo.workdir()),
            head: remote_head(&repo, &name),
            branches: remote_branch_names(&repo, &name).map_err(internal)?,
            local_branches: local_branch_names(&repo).map_err(internal)?,
        })
    })
    .await?
}

pub(super) fn setup(
    sessions: &RepoSessions,
    id: RepoId,
) -> Result<(Git, PathBuf), RepositoryError> {
    Ok((git()?, git_dir_or_work_tree(&sessions.get(id)?.repo)))
}

pub(super) async fn entries(git: &Git, dir: &Path) -> Result<Vec<ScopedEntry>, AppError> {
    read_all_scopes(git, dir, &CancellationToken::new())
        .await
        .map_err(config_error)
}

/// The settings of the remote `name`.
pub async fn settings(
    sessions: &RepoSessions,
    ssh: &SshKeysStore,
    id: RepoId,
    name: String,
) -> Result<RemoteSettingsDto, AppError> {
    let ssh_key = remote_ssh::key(sessions, ssh, id, &name);
    let (git, dir) = setup(sessions, id)?;
    let entries = entries(&git, &dir).await?;
    let refs = refs(dir, name.clone()).await?;
    Ok(RemoteSettingsDto {
        name,
        head: refs.head,
        branches: refs.branches,
        local_branches: refs.local_branches,
        uses_lfs: refs.uses_lfs,
        ssh_key,
        entries: entries
            .into_iter()
            .filter(shown)
            .map(ConfigValueDto::from)
            .collect(),
    })
}

async fn plan(git: &Git, dir: &Path, edit: RemoteEditDto) -> Result<RemoteEditPlan, AppError> {
    let edit = RemoteEdit::from(edit);
    let current = entries(git, dir).await?;
    let head = refs(dir.to_path_buf(), edit.name.clone()).await?.head;
    plan_remote_edit(&current, head.as_deref(), &edit).map_err(plan_error)
}

/// The commands saving `edit` would run, in order (secrets hidden); empty when nothing changes.
pub async fn preview(
    sessions: &RepoSessions,
    id: RepoId,
    edit: RemoteEditDto,
) -> Result<Vec<String>, AppError> {
    let (git, dir) = setup(sessions, id)?;
    Ok(describe_remote_edit(&plan(&git, &dir, edit).await?))
}

/// Saves `edit`: all of it, or nothing (what ran is undone).
pub async fn apply(
    sessions: &RepoSessions,
    ssh: &SshKeysStore,
    id: RepoId,
    edit: RemoteEditDto,
) -> Result<(), AppError> {
    let session = sessions.get(id)?;
    let old_name = edit.name.clone();
    let renamed = edit.new_name.clone().filter(|new| *new != edit.name);
    let (git, dir) = setup(sessions, id)?;
    let _writing = session.lock_writes().await;
    let plan = plan(&git, &dir, edit).await?;
    if plan.is_empty() {
        return Ok(());
    }
    apply_remote_edit(&git, &dir, &plan, &CancellationToken::new())
        .await
        .map_err(plan_error)?;
    if let Some(new_name) = renamed {
        remote_ssh::follow(sessions, ssh, id, &old_name, Some(&new_name));
    }
    Ok(())
}
