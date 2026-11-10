//! The interactive rebase: the commits it would replay from a chosen commit, and running it with
//! the edited list. What the commands take and return, and the service behind them.

use git_core::operation::{
    InteractiveOutcome, OperationError, TodoAction, TodoStep, interactive_plan,
    operation_in_progress, rebase_interactive,
};
use serde::{Deserialize, Serialize};
use specta::Type;
use tokio_util::sync::CancellationToken;

use super::error::OperationsError;
use super::service::{git, work_tree};
use crate::repository::{RepoId, RepoSessions, blocking};

/// A commit the interactive rebase replays.
#[derive(Debug, Clone, PartialEq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct PlannedCommitDto {
    pub id: String,
    pub author: String,
    /// Author time, in seconds since the epoch.
    pub time: f64,
    /// The whole message.
    pub message: String,
}

/// What an interactive rebase from a commit replays.
#[derive(Debug, Clone, PartialEq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct InteractivePlanDto {
    /// The commits from the chosen one up to HEAD, oldest first, without merge commits.
    pub commits: Vec<PlannedCommitDto>,
    /// Merge commits in the range: left out, their commits come in a line.
    pub merges: u32,
    /// How many of the commits a remote-tracking branch has (pushed already).
    pub published: u32,
}

/// What to do with one commit.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum TodoActionDto {
    Pick,
    Reword,
    Edit,
    Squash,
    Fixup,
    Drop,
}

/// One commit of the edited list, oldest first.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct TodoStepDto {
    pub action: TodoActionDto,
    /// The full commit id.
    pub commit: String,
    /// The new message of the commit this step starts (reword, or a group with squashes).
    pub message: Option<String>,
}

/// An interactive rebase from `from` (included) up to HEAD.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct InteractiveRequestDto {
    /// The oldest commit to edit (as in `get_interactive_plan`).
    pub from: String,
    /// Every commit of the plan, once, in the new order.
    pub steps: Vec<TodoStepDto>,
    /// Stash uncommitted changes first and bring them back afterwards.
    pub autostash: bool,
}

/// How an interactive rebase ended (so far).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum InteractiveOutcomeDto {
    Rebased,
    /// Stopped at an `edit`, or because a step failed; the rebase is in progress.
    Stopped,
    Conflicts,
    StashConflicts,
}

/// The outcome, with git's line saying why it stopped.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct InteractiveResultDto {
    pub outcome: InteractiveOutcomeDto,
    pub detail: Option<String>,
}

/// The commits an interactive rebase from `from` replays.
pub async fn plan(
    sessions: &RepoSessions,
    id: RepoId,
    from: String,
) -> Result<InteractivePlanDto, OperationsError> {
    let session = sessions.get(id)?;
    let dir = work_tree(&session.repo)?;
    let plan = interactive_plan(&git()?, &dir, &from, &CancellationToken::new()).await?;
    Ok(InteractivePlanDto {
        commits: plan
            .commits
            .into_iter()
            .map(|commit| PlannedCommitDto {
                id: commit.id,
                author: commit.author,
                #[allow(clippy::cast_precision_loss)] // Seconds fit an f64 exactly until 2^53.
                time: commit.time as f64,
                message: commit.message,
            })
            .collect(),
        merges: plan.merges,
        published: plan.published,
    })
}

fn step(dto: TodoStepDto) -> TodoStep {
    TodoStep {
        action: match dto.action {
            TodoActionDto::Pick => TodoAction::Pick,
            TodoActionDto::Reword => TodoAction::Reword,
            TodoActionDto::Edit => TodoAction::Edit,
            TodoActionDto::Squash => TodoAction::Squash,
            TodoActionDto::Fixup => TodoAction::Fixup,
            TodoActionDto::Drop => TodoAction::Drop,
        },
        commit: dto.commit,
        message: dto.message,
    }
}

/// Runs the interactive rebase. The plan is read again first: when the branch changed since the
/// list was made (other commits), nothing is done.
pub async fn start(
    sessions: &RepoSessions,
    id: RepoId,
    request: InteractiveRequestDto,
) -> Result<InteractiveResultDto, OperationsError> {
    let session = sessions.get(id)?;
    let dir = work_tree(&session.repo)?;
    let git = git()?;
    let _writing = session.lock_writes().await;
    let cancel = CancellationToken::new();
    let plan = interactive_plan(&git, &dir, &request.from, &cancel).await?;
    let mut planned: Vec<&str> = plan.commits.iter().map(|c| c.id.as_str()).collect();
    let mut asked: Vec<&str> = request.steps.iter().map(|s| s.commit.as_str()).collect();
    planned.sort_unstable();
    asked.sort_unstable();
    if planned != asked {
        return Err(OperationError::NotApplicable(
            "The branch changed since the list was made. Open the editor again.".to_owned(),
        )
        .into());
    }
    let steps: Vec<TodoStep> = request.steps.into_iter().map(step).collect();
    let (outcome, output) = rebase_interactive(
        &git,
        &dir,
        plan.base.as_deref(),
        &steps,
        request.autostash,
        &cancel,
    )
    .await?;
    let repo = session.repo.clone();
    let in_progress = blocking(move || operation_in_progress(&repo.local())).await?;
    let outcome = match outcome {
        InteractiveOutcome::Rebased | InteractiveOutcome::StashConflicts
            if in_progress.is_some() =>
        {
            InteractiveOutcomeDto::Stopped
        }
        InteractiveOutcome::Rebased => InteractiveOutcomeDto::Rebased,
        InteractiveOutcome::StashConflicts => InteractiveOutcomeDto::StashConflicts,
        InteractiveOutcome::Stopped => InteractiveOutcomeDto::Stopped,
        InteractiveOutcome::Conflicts => InteractiveOutcomeDto::Conflicts,
    };
    let detail = output
        .lines()
        .find(|line| {
            line.starts_with("Stopped at") || line.contains("failed") || line.contains("hint:")
        })
        .map(|line| line.trim().to_owned());
    Ok(InteractiveResultDto { outcome, detail })
}
