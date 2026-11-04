//! Applying some files of a stash: their patch (`git diff-tree`) merged in three ways by
//! `git apply --3way`, as `git stash apply` merges the whole stash, then unstaged again so the
//! result looks the same (changes in the working tree, conflicts marked in the index).

use std::path::Path;

use gix::ObjectId;
use gix::bstr::{BString, ByteSlice};
use tokio_util::sync::CancellationToken;

use super::write::{ApplyOutcome, accepted, os_path};
use super::{StashCommits, StashError};
use crate::cli::Git;

/// Paths given to one command that takes them as arguments, not on stdin.
const PATH_BATCH: usize = 200;
/// Local changes listed by name at most when refusing.
const NAMED_CHANGES: usize = 5;

/// Applies the changes of some files of a stash to the working tree: the `tracked` paths as the
/// stash changed them since its base, and the `untracked` paths it saved. Refused when one of
/// them has local changes; otherwise every file is merged (conflicts marked as by
/// `git stash apply`) or, when git refuses, nothing changes. The stash is kept.
pub async fn apply_stash_files(
    git: &Git,
    work_dir: &Path,
    stash: &StashCommits,
    tracked: &[impl AsRef<[u8]>],
    untracked: &[impl AsRef<[u8]>],
    cancel: &CancellationToken,
) -> Result<ApplyOutcome, StashError> {
    refuse_local_changes(git, work_dir, tracked, cancel).await?;
    let mut patch = Vec::new();
    for batch in tracked.chunks(PATH_BATCH) {
        let commits = [stash.base, stash.id];
        patch.extend(diff_tree(git, work_dir, &commits, batch, cancel).await?);
    }
    if !untracked.is_empty() {
        let Some(commit) = stash.untracked else {
            return Err(StashError::Rejected {
                output: "This stash has no untracked files.".to_owned(),
            });
        };
        // A commit without parents, so its patch (`--root`) adds every file.
        for batch in untracked.chunks(PATH_BATCH) {
            patch.extend(diff_tree(git, work_dir, &[commit], batch, cancel).await?);
        }
    }
    if patch.is_empty() {
        return Err(StashError::Rejected {
            output: "The stash does not change the chosen files.".to_owned(),
        });
    }

    let output = git
        .command()
        .current_dir(work_dir)
        .args(["apply", "--3way"])
        .stdin(patch)
        .output(cancel)
        .await?;
    let text = output.combined();
    let all: Vec<&[u8]> = tracked
        .iter()
        .map(AsRef::as_ref)
        .chain(untracked.iter().map(AsRef::as_ref))
        .collect();
    let conflicted = unmerged(git, work_dir, &all, cancel).await?;
    if !output.success() && conflicted.is_empty() {
        return Err(StashError::Rejected { output: text });
    }
    // `--3way` staged what it applied; leave that in the working tree only, conflicts aside.
    let clean: Vec<&[u8]> = all
        .into_iter()
        .filter(|path| !conflicted.iter().any(|conflict| conflict == path))
        .collect();
    if !clean.is_empty() {
        let reset = git
            .command()
            .current_dir(work_dir)
            .args(["reset", "--quiet"])
            .pathspecs_on_stdin(&clean);
        accepted(&reset.output(cancel).await?)?;
    }
    Ok(ApplyOutcome {
        output: text,
        conflicts: !conflicted.is_empty(),
    })
}

/// Refuses when any of `paths` differs from `HEAD` (staged or not), naming a few: applying the
/// stash would mix with them, as `git stash apply` refuses too.
async fn refuse_local_changes(
    git: &Git,
    work_dir: &Path,
    paths: &[impl AsRef<[u8]>],
    cancel: &CancellationToken,
) -> Result<(), StashError> {
    let mut changed: Vec<String> = Vec::new();
    for batch in paths.chunks(PATH_BATCH) {
        let output = git
            .command()
            .current_dir(work_dir)
            .read_only()
            .literal_pathspecs()
            .args(["diff", "--name-only", "-z", "HEAD"])
            .paths(os_paths(batch)?)
            .output(cancel)
            .await?;
        accepted(&output)?;
        changed.extend(names(&output.stdout).map(|name| name.to_str_lossy().into_owned()));
    }
    if changed.is_empty() {
        return Ok(());
    }
    let mut named = changed[..changed.len().min(NAMED_CHANGES)].join(", ");
    if changed.len() > NAMED_CHANGES {
        named = format!("{named} and {} more", changed.len() - NAMED_CHANGES);
    }
    Err(StashError::Rejected {
        output: format!(
            "These files have local changes: {named}. Commit or stash them first, then apply."
        ),
    })
}

/// Which of `paths` have merge conflicts in the index now.
async fn unmerged(
    git: &Git,
    work_dir: &Path,
    paths: &[&[u8]],
    cancel: &CancellationToken,
) -> Result<Vec<BString>, StashError> {
    let mut conflicted: Vec<BString> = Vec::new();
    for batch in paths.chunks(PATH_BATCH) {
        let output = git
            .command()
            .current_dir(work_dir)
            .read_only()
            .literal_pathspecs()
            .args(["ls-files", "--unmerged", "-z"])
            .paths(os_paths(batch)?)
            .output(cancel)
            .await?;
        accepted(&output)?;
        // `<mode> <id> <stage>\t<path>`, one per stage of each conflicted file.
        conflicted.extend(
            names(&output.stdout)
                .filter_map(|entry| entry.split_once_str(b"\t").map(|(_, path)| path.into())),
        );
    }
    conflicted.dedup();
    Ok(conflicted)
}

/// The patch (binary included, full blob ids) of `batch` between two commits, or of one root
/// commit against nothing.
async fn diff_tree(
    git: &Git,
    work_dir: &Path,
    commits: &[ObjectId],
    batch: &[impl AsRef<[u8]>],
    cancel: &CancellationToken,
) -> Result<Vec<u8>, StashError> {
    let mut command = git
        .command()
        .current_dir(work_dir)
        .read_only()
        .literal_pathspecs()
        .args([
            "diff-tree",
            "-r",
            "-p",
            "--binary",
            "--full-index",
            "--no-commit-id",
        ]);
    if commits.len() == 1 {
        command = command.arg("--root");
    }
    for commit in commits {
        command = command.revision(&commit.to_string())?;
    }
    let output = command.paths(os_paths(batch)?).output(cancel).await?;
    accepted(&output)?;
    Ok(output.stdout)
}

fn os_paths(batch: &[impl AsRef<[u8]>]) -> Result<Vec<std::path::PathBuf>, StashError> {
    batch
        .iter()
        .map(|path| os_path(path.as_ref().as_bstr()))
        .collect()
}

/// NUL-separated entries, the last one ending with NUL too.
fn names(output: &[u8]) -> impl Iterator<Item = &[u8]> {
    output
        .split(|&byte| byte == 0)
        .filter(|name| !name.is_empty())
}
