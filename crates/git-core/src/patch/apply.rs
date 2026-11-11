//! Checking and applying patches. `git apply --check` says whether they apply as they are, and
//! if not whether a three-way merge would (cleanly or with conflicts); `git apply --numstat`
//! lists the files they change. Applying changes the files (`git apply`, falling back to
//! `--3way`, which stages them and may leave conflicts) or makes commits from mails
//! (`git am --3way`, which stops with the operation in progress when one does not apply).

use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

use tokio_util::sync::CancellationToken;

use super::PatchError;
use crate::cli::{Git, GitCommand, GitOutput};

/// Most changed files listed by a check; the rest are only counted.
pub const MAX_LISTED_PATHS: usize = 500;

/// Whether patches apply to the working tree as it is.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PatchFit {
    /// They apply as they are.
    Clean,
    /// Only with a three-way merge, which merges cleanly.
    ThreeWay,
    /// Only with a three-way merge, which leaves conflicts to resolve.
    Conflicts,
    /// They do not apply; `output` is git's reason.
    Fails {
        /// What git said.
        output: String,
    },
}

/// A file the patches change, with its added and removed lines (`None` for binary files).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PatchedPath {
    /// Its path (the new one for a rename), `/` separated.
    pub path: String,
    /// Lines added.
    pub added: Option<u32>,
    /// Lines removed.
    pub removed: Option<u32>,
}

/// What a check found.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PatchCheck {
    /// Whether they apply.
    pub fit: PatchFit,
    /// The files they change, at most [`MAX_LISTED_PATHS`], in order of appearance.
    pub paths: Vec<PatchedPath>,
    /// How many files they change.
    pub total_paths: usize,
}

/// How applying with `git apply` ended.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ApplyOutcome {
    /// The files changed; nothing was staged.
    Applied,
    /// A three-way merge applied them; the changes are staged.
    Merged,
    /// A three-way merge left conflicts in the files to resolve.
    Conflicts,
}

/// How `git am` ended.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AmOutcome {
    /// Every mail became a commit.
    Committed,
    /// It stopped on a mail that did not apply (or with conflicts); `git am` is in progress.
    Stopped,
}

/// `git apply` reading `input` (the patch files, one after the other) on standard input.
fn apply(git: &Git, dir: &Path, input: &[u8]) -> GitCommand {
    git.command()
        .current_dir(dir)
        .arg("apply")
        .stdin(input.to_vec())
}

/// The files one after the other: given as separate files, git applies each to the original
/// files, so a second patch to the same file would not find the first one's lines.
fn joined(files: &[PathBuf]) -> Result<Vec<u8>, PatchError> {
    let mut input = Vec::new();
    for file in files {
        input.extend(fs::read(file).map_err(PatchError::io(file))?);
        if input.last().is_some_and(|&byte| byte != b'\n') {
            input.push(b'\n');
        }
    }
    Ok(input)
}

fn sum(total: Option<u32>, more: Option<u32>) -> Option<u32> {
    Some(total?.saturating_add(more?))
}

/// The files of `git apply --numstat -z` output, the same path counted once.
pub fn parse_numstat(output: &[u8]) -> (Vec<PatchedPath>, usize) {
    let mut fields = output.split(|&byte| byte == 0);
    let mut paths: Vec<PatchedPath> = Vec::new();
    let mut seen: HashMap<String, usize> = HashMap::new();
    while let Some(record) = fields.next() {
        let text = String::from_utf8_lossy(record);
        let mut parts = text.splitn(3, '\t');
        let (Some(added), Some(removed), Some(path)) = (parts.next(), parts.next(), parts.next())
        else {
            continue;
        };
        // A rename: `added \t removed \t \0 old \0 new`.
        let path = if path.is_empty() {
            let _old = fields.next();
            fields
                .next()
                .map(|new| String::from_utf8_lossy(new).into_owned())
                .unwrap_or_default()
        } else {
            path.to_owned()
        };
        let (added, removed) = (added.parse().ok(), removed.parse().ok());
        if let Some(&index) = seen.get(&path) {
            let entry = &mut paths[index];
            entry.added = sum(entry.added, added);
            entry.removed = sum(entry.removed, removed);
        } else {
            seen.insert(path.clone(), paths.len());
            paths.push(PatchedPath {
                path,
                added,
                removed,
            });
        }
    }
    let total = paths.len();
    paths.truncate(MAX_LISTED_PATHS);
    (paths, total)
}

async fn run(command: GitCommand, cancel: &CancellationToken) -> Result<GitOutput, PatchError> {
    Ok(command.output(cancel).await?)
}

/// Checks whether `files` apply in `dir` in this order, as `git am` (`index`: the index and
/// the files must match) or `git apply` would apply them, and lists the files they change.
pub async fn check_patches(
    git: &Git,
    dir: &Path,
    files: &[PathBuf],
    index: bool,
    cancel: &CancellationToken,
) -> Result<PatchCheck, PatchError> {
    let input = joined(files)?;
    let numstat = run(apply(git, dir, &input).args(["--numstat", "-z"]), cancel).await?;
    if !numstat.success() {
        return Ok(PatchCheck {
            fit: PatchFit::Fails {
                output: numstat.combined(),
            },
            paths: Vec::new(),
            total_paths: 0,
        });
    }
    let (paths, total_paths) = parse_numstat(&numstat.stdout);
    let mut plain = apply(git, dir, &input).arg("--check");
    if index {
        plain = plain.arg("--index");
    }
    let plain = run(plain, cancel).await?;
    let fit = if plain.success() {
        PatchFit::Clean
    } else {
        let merged = run(apply(git, dir, &input).args(["--check", "--3way"]), cancel).await?;
        let text = merged.combined();
        if merged.success() && text.contains("with conflicts") {
            PatchFit::Conflicts
        } else if merged.success() {
            PatchFit::ThreeWay
        } else if text.contains("does not match index") {
            // The real obstacle: changes not staged in a file the merge would touch.
            PatchFit::Fails { output: text }
        } else {
            PatchFit::Fails {
                output: plain.combined(),
            }
        }
    };
    Ok(PatchCheck {
        fit,
        paths,
        total_paths,
    })
}

/// Applies `files` to the working tree of `dir` with `git apply`: as they are when they apply,
/// else with a three-way merge (`--3way`; the changes are staged). git applies all or nothing.
pub async fn apply_patches(
    git: &Git,
    dir: &Path,
    files: &[PathBuf],
    cancel: &CancellationToken,
) -> Result<(ApplyOutcome, String), PatchError> {
    let input = joined(files)?;
    let plain = run(apply(git, dir, &input), cancel).await?;
    if plain.success() {
        return Ok((ApplyOutcome::Applied, plain.combined()));
    }
    let merged = run(apply(git, dir, &input).arg("--3way"), cancel).await?;
    let text = merged.combined();
    if merged.success() {
        Ok((ApplyOutcome::Merged, text))
    } else if text.contains("with conflicts") {
        Ok((ApplyOutcome::Conflicts, text))
    } else {
        Err(PatchError::Rejected { output: text })
    }
}

/// Makes commits from the mails in `files` with `git am --3way`, on the current branch of
/// `dir`. A mail that does not apply stops it with `git am` in progress (not an error).
pub async fn apply_mailbox(
    git: &Git,
    dir: &Path,
    files: &[PathBuf],
    cancel: &CancellationToken,
) -> Result<(AmOutcome, String), PatchError> {
    let command = git
        .command()
        .current_dir(dir)
        .args(["am", "--3way"])
        .paths(files);
    let output = run(command, cancel).await?;
    let text = output.combined();
    if output.success() {
        Ok((AmOutcome::Committed, text))
    } else if text.contains("Patch failed at") || text.contains("am --skip") {
        Ok((AmOutcome::Stopped, text))
    } else {
        Err(PatchError::Rejected { output: text })
    }
}

#[cfg(test)]
mod tests {
    use super::{PatchedPath, parse_numstat};

    #[test]
    fn counts_each_file_once() {
        let output =
            b"1\t1\tf.txt\x001\t0\tf.txt\x00-\t-\timage.png\x002\t1\t\x00old.txt\x00new.txt\x00";
        let (paths, total) = parse_numstat(output);
        assert_eq!(total, 3);
        assert_eq!(
            paths,
            vec![
                PatchedPath {
                    path: "f.txt".into(),
                    added: Some(2),
                    removed: Some(1),
                },
                PatchedPath {
                    path: "image.png".into(),
                    added: None,
                    removed: None,
                },
                PatchedPath {
                    path: "new.txt".into(),
                    added: Some(2),
                    removed: Some(1),
                },
            ]
        );
    }
}
