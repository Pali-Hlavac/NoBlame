//! Creating patches with `git format-patch`: of one commit, or of the commits after a base up
//! to a tip (merges are left out: a patch cannot hold one). Into one file (a mailbox `git am`
//! takes), or one file per commit in a folder, where files of the same name are never replaced.

use std::fs;
use std::path::{Path, PathBuf};

use tokio_util::sync::CancellationToken;

use super::PatchError;
use crate::cli::{Git, GitCommand, GitError};

/// Most commits one request makes patches of.
pub const MAX_PATCH_COMMITS: u32 = 1_000;

/// Files in the way named in the refusal; the rest are counted.
const NAMED_FILES: usize = 5;

/// Which commits get patches.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PatchCommits {
    /// The newest commit (a revision).
    pub tip: String,
    /// The commits after this one up to `tip`; `None`: `tip` alone.
    pub base: Option<String>,
}

/// How many commits a range holds.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PatchCount {
    /// Commits that get a patch.
    pub commits: u32,
    /// Merge commits, left out.
    pub merges: u32,
}

impl PatchCommits {
    /// `tip^!` (the commit alone) or `base..tip`, after checking both exist.
    async fn range(
        &self,
        git: &Git,
        dir: &Path,
        cancel: &CancellationToken,
    ) -> Result<String, PatchError> {
        for revision in std::iter::once(&self.tip).chain(&self.base) {
            let exists = git
                .command()
                .current_dir(dir)
                .read_only()
                .args(["rev-parse", "--verify", "--quiet"])
                .revision(&format!("{revision}^{{commit}}"))?
                .output(cancel)
                .await?;
            if !exists.success() {
                return Err(PatchError::Invalid(format!(
                    "There is no branch, tag or commit named “{revision}” here."
                )));
            }
        }
        Ok(match &self.base {
            Some(base) => format!("{base}..{}", self.tip),
            None => format!("{}^!", self.tip),
        })
    }

    /// `-1 tip` or `base..tip` appended to `command`.
    fn push(&self, command: GitCommand) -> Result<GitCommand, GitError> {
        match &self.base {
            Some(base) => command.revision(&format!("{base}..{}", self.tip)),
            None => command.arg("-1").revision(&self.tip),
        }
    }
}

async fn count(
    git: &Git,
    dir: &Path,
    range: &str,
    merges: &'static str,
    cancel: &CancellationToken,
) -> Result<u32, PatchError> {
    let output = git
        .command()
        .current_dir(dir)
        .read_only()
        .args(["rev-list", "--count", merges])
        .revision(range)?
        .run(cancel)
        .await?;
    output
        .stdout_lossy()
        .trim()
        .parse()
        .map_err(|_| PatchError::Invalid("git did not say how many commits there are.".into()))
}

/// How many commits `commits` holds, and how many of them are merges (left out).
pub async fn count_patches(
    git: &Git,
    dir: &Path,
    commits: &PatchCommits,
    cancel: &CancellationToken,
) -> Result<PatchCount, PatchError> {
    let range = commits.range(git, dir, cancel).await?;
    Ok(PatchCount {
        commits: count(git, dir, &range, "--no-merges", cancel).await?,
        merges: count(git, dir, &range, "--merges", cancel).await?,
    })
}

async fn format_patch(
    git: &Git,
    dir: &Path,
    commits: &PatchCommits,
    output: (&'static str, &Path),
    cancel: &CancellationToken,
) -> Result<(), PatchError> {
    let command = git
        .command()
        .current_dir(dir)
        .arg("format-patch")
        .option(output.0, output.1);
    let result = commits.push(command)?.output(cancel).await?;
    if result.success() {
        Ok(())
    } else {
        Err(PatchError::Rejected {
            output: result.combined(),
        })
    }
}

/// Writes the patches of `commits` into `file`, one after the other (a mailbox).
pub async fn write_patch_file(
    git: &Git,
    dir: &Path,
    commits: &PatchCommits,
    file: &Path,
    cancel: &CancellationToken,
) -> Result<(), PatchError> {
    format_patch(git, dir, commits, ("--output", file), cancel).await
}

/// Writes one patch per commit of `commits` into `folder` (`0001-Subject.patch`, ...) and
/// returns their paths. Refused, writing nothing, when a file of the same name is there.
pub async fn write_patch_folder(
    git: &Git,
    dir: &Path,
    commits: &PatchCommits,
    folder: &Path,
    cancel: &CancellationToken,
) -> Result<Vec<PathBuf>, PatchError> {
    // git replaces files of the same name: write elsewhere, then copy what is not in the way.
    let staging = tempfile::Builder::new()
        .prefix("noblame-patches-")
        .tempdir()
        .map_err(PatchError::io(std::env::temp_dir()))?;
    format_patch(
        git,
        dir,
        commits,
        ("--output-directory", staging.path()),
        cancel,
    )
    .await?;
    let mut names: Vec<_> = fs::read_dir(staging.path())
        .map_err(PatchError::io(staging.path()))?
        .filter_map(|entry| entry.ok().map(|entry| entry.file_name()))
        .collect();
    names.sort();
    let taken: Vec<_> = names
        .iter()
        .filter(|name| folder.join(name).exists())
        .map(|name| name.to_string_lossy().into_owned())
        .collect();
    if !taken.is_empty() {
        return Err(PatchError::Invalid(files_in_the_way(&taken)));
    }
    let mut written = Vec::with_capacity(names.len());
    for name in names {
        let target = folder.join(&name);
        fs::copy(staging.path().join(&name), &target).map_err(PatchError::io(&target))?;
        written.push(target);
    }
    Ok(written)
}

fn files_in_the_way(taken: &[String]) -> String {
    let named = taken
        .iter()
        .take(NAMED_FILES)
        .cloned()
        .collect::<Vec<_>>()
        .join(", ");
    let more = taken.len().saturating_sub(NAMED_FILES);
    let more = if more > 0 {
        format!(" and {more} more")
    } else {
        String::new()
    };
    format!(
        "The folder already has files of these names: {named}{more}. Choose another folder, \
         or move them away first."
    )
}

#[cfg(test)]
mod tests {
    use super::files_in_the_way;

    #[test]
    fn names_the_first_files_in_the_way() {
        let taken: Vec<String> = (1..=7).map(|n| format!("000{n}-a.patch")).collect();
        let message = files_in_the_way(&taken);
        assert!(message.contains("0001-a.patch, 0002-a.patch"));
        assert!(message.contains("0005-a.patch and 2 more."));
        assert!(!message.contains("0006"));
    }
}
