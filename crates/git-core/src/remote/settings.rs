//! Saving a remote's settings from the remote editor, all or nothing: the keys first
//! (`config::plan`), then its default branch (`git remote set-head`), then its name (`git
//! remote rename`, which moves its section, remote branches and the upstreams naming it). When a
//! step fails, the steps before it are undone in reverse order.

use std::path::Path;

use tokio_util::sync::CancellationToken;

use crate::cli::Git;
use crate::config::{
    KeyChange, PlanError, PlannedKey, ScopedEntry, apply_plan, describe_plan, failed, plan_changes,
    quote, restore,
};

use super::validate::validate_remote_name;

/// A change of the remote's default branch (`refs/remotes/<name>/HEAD`), by branch name.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HeadChange {
    /// The branch it pointed at when the editor read it; `None`: not set.
    pub before: Option<String>,
    /// The branch wanted; `None` removes it.
    pub after: Option<String>,
}

/// What the editor saves for one remote.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RemoteEdit {
    /// The remote's name now; keys name it too.
    pub name: String,
    /// Its name after, when it changes.
    pub new_name: Option<String>,
    /// Its default branch, when it changes.
    pub head: Option<HeadChange>,
    /// Settings, by key.
    pub keys: Vec<KeyChange>,
}

/// An edit checked against the repository, ready to apply.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RemoteEditPlan {
    name: String,
    keys: Vec<PlannedKey>,
    head: Option<HeadChange>,
    new_name: Option<String>,
}

impl RemoteEditPlan {
    /// Whether nothing would change.
    pub fn is_empty(&self) -> bool {
        self.keys.is_empty() && self.head.is_none() && self.new_name.is_none()
    }
}

/// Checks `edit` against `current` (every scope's settings, read now) and the default branch
/// now (`head_now`).
pub fn plan_remote_edit(
    current: &[ScopedEntry],
    head_now: Option<&str>,
    edit: &RemoteEdit,
) -> Result<RemoteEditPlan, PlanError> {
    let keys = plan_changes(current, &edit.keys)?;
    let head = match &edit.head {
        Some(change) if change.before.as_deref() != head_now => {
            return Err(PlanError::Changed {
                key: format!("The default branch of {}", edit.name),
            });
        }
        Some(change) if change.before == change.after => None,
        other => other.clone(),
    };
    let new_name = edit.new_name.clone().filter(|new| *new != edit.name);
    if let Some(new_name) = &new_name {
        validate_remote_name(new_name).map_err(|error| PlanError::Failed {
            message: error.to_string(),
            restored: true,
        })?;
    }
    Ok(RemoteEditPlan {
        name: edit.name.clone(),
        keys,
        head,
        new_name,
    })
}

/// The commands `plan` runs, in order, as a terminal would take them; secrets hidden.
pub fn describe_remote_edit(plan: &RemoteEditPlan) -> Vec<String> {
    let mut lines = describe_plan(&plan.keys);
    let name = quote(&plan.name);
    if let Some(head) = &plan.head {
        lines.push(match &head.after {
            Some(branch) => format!("git remote set-head {name} {}", quote(branch)),
            None => format!("git remote set-head --delete {name}"),
        });
    }
    if let Some(new_name) = &plan.new_name {
        lines.push(format!("git remote rename {name} {}", quote(new_name)));
    }
    lines
}

async fn set_head(
    git: &Git,
    dir: &Path,
    name: &str,
    branch: Option<&str>,
    cancel: &CancellationToken,
) -> Result<(), String> {
    let command = git.command().current_dir(dir).args(["remote", "set-head"]);
    let command = match branch {
        Some(branch) => command.operands([name, branch]),
        None => command.arg("--delete").operands([name]),
    };
    let output = command
        .output(cancel)
        .await
        .map_err(|error| error.to_string())?;
    if output.success() {
        Ok(())
    } else {
        Err(output.combined())
    }
}

async fn rename(
    git: &Git,
    dir: &Path,
    name: &str,
    new_name: &str,
    cancel: &CancellationToken,
) -> Result<(), String> {
    let command = git
        .command()
        .current_dir(dir)
        .args(["remote", "rename", "--no-progress"])
        .operands([name, new_name]);
    let output = command
        .output(cancel)
        .await
        .map_err(|error| error.to_string())?;
    if output.success() {
        Ok(())
    } else {
        Err(output.combined())
    }
}

/// Applies `plan`: keys, default branch, name. A failure undoes what ran before it.
pub async fn apply_remote_edit(
    git: &Git,
    dir: &Path,
    plan: &RemoteEditPlan,
    cancel: &CancellationToken,
) -> Result<(), PlanError> {
    apply_plan(git, dir, &plan.keys, cancel).await?;
    if let Some(head) = &plan.head
        && let Err(said) = set_head(git, dir, &plan.name, head.after.as_deref(), cancel).await
    {
        let restored = restore(git, dir, &plan.keys).await;
        return Err(failed("the default branch", &said, restored));
    }
    if let Some(new_name) = &plan.new_name
        && let Err(said) = rename(git, dir, &plan.name, new_name, cancel).await
    {
        // Not cancellable: undoing must finish.
        let undo = CancellationToken::new();
        let head_back = match &plan.head {
            Some(head) => set_head(git, dir, &plan.name, head.before.as_deref(), &undo)
                .await
                .is_ok(),
            None => true,
        };
        let restored = restore(git, dir, &plan.keys).await && head_back;
        return Err(failed("the new name", &said, restored));
    }
    Ok(())
}
