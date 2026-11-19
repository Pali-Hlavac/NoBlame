//! The interactive rebase: the commits it would replay from a chosen commit up to HEAD (the
//! plan), and running `git rebase -i` with NoBlame's todo list (`todo.rs`). git learns the todo
//! through `GIT_SEQUENCE_EDITOR`: a shell function that copies NoBlame's file over git's, with
//! shell builtins only (no `cp` needed on git's `PATH`). Other editors are `true`, so nothing
//! waits for a terminal.

use std::io::Write as _;
use std::path::Path;

use tokio_util::sync::CancellationToken;

use super::OperationError;
use super::todo::{TodoStep, todo_script};
use crate::cli::{Git, GitOutput};

/// More commits than this are not listed in the editor.
pub const MAX_INTERACTIVE_COMMITS: u32 = 500;

/// A commit the interactive rebase replays.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PlannedCommit {
    /// Full id.
    pub id: String,
    /// Author name.
    pub author: String,
    /// Author time, in seconds since the epoch.
    pub time: i64,
    /// The whole message (lossy UTF-8: only shown and edited).
    pub message: String,
}

/// What an interactive rebase from a commit would replay.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct InteractivePlan {
    /// The commit the replayed commits go on (the chosen commit's first parent); `None` when the
    /// chosen commit is a root commit (`--root`).
    pub base: Option<String>,
    /// The commits from the chosen one up to HEAD, oldest first, without merge commits.
    pub commits: Vec<PlannedCommit>,
    /// How many merge commits the range has: they are left out, their commits come in a line.
    pub merges: u32,
    /// How many of the commits a remote-tracking branch has (pushed already).
    pub published: u32,
}

/// How an interactive rebase ended (so far).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum InteractiveOutcome {
    /// Every step was done.
    Rebased,
    /// It stopped as asked (an `edit`), or because a step failed (a hook refused a message):
    /// the rebase is in progress.
    Stopped,
    /// It stopped at a commit whose changes conflict.
    Conflicts,
    /// Done, but the stashed changes conflicted when brought back.
    StashConflicts,
}

fn checked(output: GitOutput) -> Result<GitOutput, OperationError> {
    if output.success() {
        Ok(output)
    } else {
        Err(OperationError::Rejected {
            output: output.combined(),
        })
    }
}

async fn count(
    git: &Git,
    work_dir: &Path,
    range: &str,
    extra: &'static [&'static str],
    cancel: &CancellationToken,
) -> Result<u32, OperationError> {
    let output = git
        .command()
        .current_dir(work_dir)
        .read_only()
        .args(["rev-list", "--count"])
        .revision(range)?
        // After the range: `--not` turns every revision after it around.
        .args(extra.iter().copied())
        .output(cancel)
        .await?;
    Ok(checked(output)?.stdout_lossy().trim().parse().unwrap_or(0))
}

/// The commits an interactive rebase from `from` (included) up to HEAD replays. Refused when
/// `from` is not on the current branch, or the range has more than
/// [`MAX_INTERACTIVE_COMMITS`] commits. Read-only.
pub async fn interactive_plan(
    git: &Git,
    work_dir: &Path,
    from: &str,
    cancel: &CancellationToken,
) -> Result<InteractivePlan, OperationError> {
    let output = git
        .command()
        .current_dir(work_dir)
        .read_only()
        .args(["log", "-1", "--format=%H %P"])
        .revision(from)?
        .output(cancel)
        .await?;
    let line = checked(output)?.stdout_lossy();
    let mut ids = line.split_whitespace();
    let id = ids.next().unwrap_or_default().to_owned();
    let base = ids.next().map(str::to_owned);
    let ancestor = git
        .command()
        .current_dir(work_dir)
        .read_only()
        .args(["merge-base", "--is-ancestor"])
        .revision(&id)?
        .arg("HEAD")
        .output(cancel)
        .await?;
    if !ancestor.success() {
        return Err(OperationError::NotApplicable(
            "This commit is not on the current branch: only commits HEAD has can be edited."
                .to_owned(),
        ));
    }
    let range = base
        .as_ref()
        .map_or_else(|| "HEAD".to_owned(), |base| format!("{base}..HEAD"));
    let total = count(git, work_dir, &range, &["--no-merges"], cancel).await?;
    if total > MAX_INTERACTIVE_COMMITS {
        return Err(OperationError::NotApplicable(format!(
            "There are {total} commits from here; at most {MAX_INTERACTIVE_COMMITS} can be \
             edited at once. Choose a newer commit."
        )));
    }
    let merges = count(git, work_dir, &range, &["--merges"], cancel).await?;
    let local = count(
        git,
        work_dir,
        &range,
        &["--no-merges", "--not", "--remotes"],
        cancel,
    )
    .await?;
    let published = total.saturating_sub(local);
    let output = git
        .command()
        .current_dir(work_dir)
        .read_only()
        .args(["log", "--reverse", "--topo-order", "--no-merges", "-z"])
        .arg("--format=%H%x00%an%x00%at%x00%B")
        .revision(&range)?
        .output(cancel)
        .await?;
    let output = checked(output)?;
    let fields: Vec<&[u8]> = output.stdout.split(|byte| *byte == 0).collect();
    let commits = fields
        .as_chunks::<4>()
        .0
        .iter()
        .map(|record| PlannedCommit {
            id: String::from_utf8_lossy(record[0]).trim().to_owned(),
            author: String::from_utf8_lossy(record[1]).into_owned(),
            time: String::from_utf8_lossy(record[2])
                .trim()
                .parse()
                .unwrap_or(0),
            message: String::from_utf8_lossy(record[3]).trim_end().to_owned(),
        })
        .collect();
    Ok(InteractivePlan {
        base,
        commits,
        merges,
        published,
    })
}

/// `text` quoted for `sh` (single quotes; a quote is closed, escaped and reopened).
fn sh_quoted_path(path: &Path) -> String {
    let text = path.to_string_lossy().replace('\\', "/");
    format!("'{}'", text.replace('\'', r"'\''"))
}

/// Rebases HEAD in `work_dir` interactively on `base` (`None`: from the root) with `steps`.
/// Conflicts, an `edit` and a failed step are outcomes, not errors: the rebase is then in
/// progress. Refused (nothing changed) when git does not start it.
pub async fn rebase_interactive(
    git: &Git,
    work_dir: &Path,
    base: Option<&str>,
    steps: &[TodoStep],
    autostash: bool,
    cancel: &CancellationToken,
) -> Result<(InteractiveOutcome, String), OperationError> {
    let script = todo_script(steps)?;
    let mut file = tempfile::Builder::new()
        .prefix("noblame-todo-")
        .suffix(".txt")
        .tempfile()
        .map_err(|error| OperationError::Read(error.to_string()))?;
    file.write_all(script.as_bytes())
        .map_err(|error| OperationError::Read(error.to_string()))?;
    // Closed, so git's shell can read it on every platform; deleted when `todo` is dropped.
    let todo = file.into_temp_path();
    // git runs `<editor> "$@"` with the todo file's path: the function copies ours over it.
    let editor = format!(
        "noblame_todo() {{ while IFS= read -r line || [ -n \"$line\" ]; do printf '%s\\n' \
         \"$line\"; done < {} > \"$1\"; }}; noblame_todo",
        sh_quoted_path(&todo)
    );
    let mut command = git
        .command()
        .current_dir(work_dir)
        .env("GIT_SEQUENCE_EDITOR", editor)
        .env("GIT_EDITOR", "true")
        .args(["rebase", "--interactive"])
        .arg(if autostash {
            "--autostash"
        } else {
            "--no-autostash"
        });
    command = match base {
        Some(base) => command.revision(base)?,
        None => command.arg("--root"),
    };
    let output = command.output(cancel).await?;
    drop(todo);
    let text = output.combined();
    let outcome = if text.contains("CONFLICT") || text.contains("could not apply") {
        InteractiveOutcome::Conflicts
    } else if text.contains("Stopped at") || text.contains("execution failed") {
        InteractiveOutcome::Stopped
    } else if !output.success() {
        return Err(OperationError::Rejected { output: text });
    } else if text.contains("resulted in conflicts") {
        InteractiveOutcome::StashConflicts
    } else {
        InteractiveOutcome::Rebased
    };
    Ok((outcome, text))
}
