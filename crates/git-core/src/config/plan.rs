//! Changing several settings of the repository's own file at once, all or nothing. An editor
//! sends, per key, the values it read (as shown: secrets hidden) and the values it wants; the
//! plan checks nothing changed meanwhile, puts hidden secrets back, and lists the `git config`
//! commands. Applying runs them key by key; when one fails, every key already touched gets its
//! earlier values back. Keys with several values (`remote.<name>.pushurl`, `fetch`) are
//! written as a whole: `--unset-all`, then `--add` per value, so none is lost or reordered.

use std::path::Path;

use tokio_util::sync::CancellationToken;

use crate::cli::Git;

use super::scoped::{Scope, ScopedEntry, canonical_key};
use super::secret::{holds_hidden, redact_key, redact_value};
use super::{ConfigError, validate_key};

/// One key's values before (as the editor was shown them) and after (as wanted; none removes
/// the key). Only the repository's own values (`--local`) are compared and written.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct KeyChange {
    /// The key, as the editor names it (`remote.origin.tagOpt`).
    pub key: String,
    /// Its values in this repository's file when the editor read them, secrets hidden.
    pub before: Vec<String>,
    /// The values wanted, in order; secrets may still be hidden (`***`) when unchanged.
    pub after: Vec<String>,
}

/// What a step does to its key.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum StepAction {
    /// `--unset-all`: removes every value (fine when there is none).
    UnsetAll,
    /// `--replace-all`: the key gets this one value.
    ReplaceAll(String),
    /// `--add`: one more value.
    Add(String),
}

/// A key's change, ready to run: its real values before and after.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PlannedKey {
    /// The key.
    pub key: String,
    /// Its values in the repository's file now (secrets included), to restore on failure.
    pub before: Vec<String>,
    /// Its values after (secrets put back).
    pub after: Vec<String>,
}

/// Why a change cannot be planned or applied.
#[derive(Debug, thiserror::Error)]
pub enum PlanError {
    /// Reading or writing failed (`git config`).
    #[error(transparent)]
    Config(#[from] ConfigError),
    /// The key's values are not what the editor was shown.
    #[error("{key} changed since the editor read it. Close the editor and open it again.")]
    Changed {
        /// The key.
        key: String,
    },
    /// A value holds `***` that does not stand for a value the key has.
    #[error(
        "{key}: “***” stands for a hidden password. Type the password again, or leave the value as it was."
    )]
    HiddenValue {
        /// The key.
        key: String,
    },
    /// A write failed; `restored` tells whether the earlier values are back.
    #[error("{message}")]
    Failed {
        /// What failed, git's words and whether the rest was undone.
        message: String,
        /// Whether every key touched has its earlier values again.
        restored: bool,
    },
}

/// The plan for `changes` against `current` (every scope's entries, as read just now). Keys
/// whose values stay the same are left out.
pub fn plan_changes(
    current: &[ScopedEntry],
    changes: &[KeyChange],
) -> Result<Vec<PlannedKey>, PlanError> {
    let mut planned = Vec::new();
    for change in changes {
        if holds_hidden(&change.key) {
            return Err(ConfigError::InvalidKey(change.key.clone()).into());
        }
        validate_key(&change.key)?;
        let wanted = canonical_key(&change.key);
        let before: Vec<String> = current
            .iter()
            .filter(|entry| entry.scope == Scope::Local && entry.key == wanted)
            .map(|entry| entry.value.clone())
            .collect();
        let shown: Vec<String> = before
            .iter()
            .map(|value| redact_value(&change.key, value))
            .collect();
        if shown != change.before {
            return Err(PlanError::Changed {
                key: redact_key(&change.key),
            });
        }
        let mut after = Vec::with_capacity(change.after.len());
        for value in &change.after {
            // A value shown hidden and sent back unchanged is the value it stands for.
            match shown.iter().position(|shown| shown == value) {
                Some(index) => after.push(before[index].clone()),
                None if holds_hidden(value) => {
                    return Err(PlanError::HiddenValue {
                        key: redact_key(&change.key),
                    });
                }
                None => after.push(value.clone()),
            }
        }
        if after != before {
            planned.push(PlannedKey {
                key: change.key.clone(),
                before,
                after,
            });
        }
    }
    Ok(planned)
}

/// The steps that give `key` exactly `values`, knowing it has `had` now.
pub fn steps_for(had: &[String], values: &[String]) -> Vec<StepAction> {
    match values {
        [] => vec![StepAction::UnsetAll],
        [one] => vec![StepAction::ReplaceAll(one.clone())],
        many => {
            let mut steps = Vec::with_capacity(many.len() + 1);
            if !had.is_empty() {
                steps.push(StepAction::UnsetAll);
            }
            steps.extend(many.iter().cloned().map(StepAction::Add));
            steps
        }
    }
}

/// The command lines of `plan`, as a terminal would take them, secrets hidden.
pub fn describe_plan(plan: &[PlannedKey]) -> Vec<String> {
    plan.iter()
        .flat_map(|key| {
            steps_for(&key.before, &key.after)
                .into_iter()
                .map(|step| describe_step(&key.key, &step))
        })
        .collect()
}

fn describe_step(key: &str, step: &StepAction) -> String {
    let shown_key = quote(&redact_key(key));
    match step {
        StepAction::UnsetAll => format!("git config --local --unset-all {shown_key}"),
        StepAction::ReplaceAll(value) => format!(
            "git config --local --replace-all {shown_key} {}",
            quote(&redact_value(key, value))
        ),
        StepAction::Add(value) => format!(
            "git config --local --add {shown_key} {}",
            quote(&redact_value(key, value))
        ),
    }
}

/// `text` quoted for showing when a shell would split or change it.
pub fn quote(text: &str) -> String {
    let plain = !text.is_empty()
        && text
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || "-_./:@+=,~%^".contains(c));
    if plain {
        text.to_owned()
    } else {
        format!("\"{}\"", text.replace('\\', "\\\\").replace('"', "\\\""))
    }
}

/// `git config --unset-all` exits with this when the key does not exist.
const KEY_MISSING: i32 = 5;

async fn run_step(
    git: &Git,
    dir: &Path,
    key: &str,
    step: &StepAction,
    cancel: &CancellationToken,
) -> Result<(), String> {
    let command = git.command().current_dir(dir).args(["config", "--local"]);
    let command = match step {
        StepAction::UnsetAll => command.arg("--unset-all").operands([key]),
        StepAction::ReplaceAll(value) => command.arg("--replace-all").operands([key, value]),
        StepAction::Add(value) => command.arg("--add").operands([key, value]),
    };
    let output = command
        .output(cancel)
        .await
        .map_err(|error| error.to_string())?;
    if output.success() || (*step == StepAction::UnsetAll && output.code == Some(KEY_MISSING)) {
        Ok(())
    } else {
        Err(output.combined())
    }
}

/// A failed write: git's words, and whether an earlier step had changed the key already.
struct WriteFailure {
    said: String,
    touched: bool,
}

/// Gives `key` exactly `values` (it has `had` now).
async fn write_key(
    git: &Git,
    dir: &Path,
    key: &str,
    had: &[String],
    values: &[String],
    cancel: &CancellationToken,
) -> Result<(), WriteFailure> {
    for (index, step) in steps_for(had, values).iter().enumerate() {
        run_step(git, dir, key, step, cancel)
            .await
            .map_err(|said| WriteFailure {
                said,
                touched: index > 0,
            })?;
    }
    Ok(())
}

/// Gives every key of `done` its `before` values again; true when all of them are back.
pub async fn restore(git: &Git, dir: &Path, done: &[PlannedKey]) -> bool {
    // Not cancellable: undoing half a change must finish.
    let cancel = CancellationToken::new();
    let mut restored = true;
    // The key may hold anything after a failed write: "had something" makes the first step
    // clear it.
    let anything = [String::new()];
    for key in done.iter().rev() {
        if write_key(git, dir, &key.key, &anything, &key.before, &cancel)
            .await
            .is_err()
        {
            restored = false;
        }
    }
    restored
}

/// Applies `plan`; on failure, the keys already touched get their earlier values back.
pub async fn apply_plan(
    git: &Git,
    dir: &Path,
    plan: &[PlannedKey],
    cancel: &CancellationToken,
) -> Result<(), PlanError> {
    for (index, key) in plan.iter().enumerate() {
        if let Err(failure) = write_key(git, dir, &key.key, &key.before, &key.after, cancel).await {
            // A key whose first step failed is as it was.
            let done = if failure.touched { index + 1 } else { index };
            let restored = restore(git, dir, &plan[..done]).await;
            return Err(failed(&key.key, &failure.said, restored));
        }
    }
    Ok(())
}

/// The message of a failed write.
pub fn failed(what: &str, said: &str, restored: bool) -> PlanError {
    let after = if restored {
        "Nothing was changed: the settings already saved were put back."
    } else {
        "Some settings could not be put back; check them in the Advanced tab."
    };
    PlanError::Failed {
        message: format!(
            "Could not save {}: {}\n{after}",
            redact_key(what),
            said.trim()
        ),
        restored,
    }
}

#[cfg(test)]
#[path = "plan_tests.rs"]
mod tests;
