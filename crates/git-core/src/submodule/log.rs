//! The commits between two pointers of a submodule (what `git diff --submodule=log` lists): the
//! ones the new pointer has and the old one does not, and the other way round when it went back
//! or sideways. Read with `git log` in the submodule's own clone, which must be checked out and
//! have both commits.

use std::path::{Component, Path, PathBuf};

use tokio_util::sync::CancellationToken;

use super::SubmoduleError;
use crate::cli::Git;

/// More commits than this are not listed on each side.
pub const MAX_POINTER_COMMITS: usize = 200;

/// A commit between two pointers.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PointerCommit {
    /// Full id.
    pub id: String,
    /// The first line of its message (lossy UTF-8: only shown).
    pub summary: String,
    /// Author name.
    pub author: String,
    /// Author time, in seconds since the epoch.
    pub time: i64,
}

/// The commits between two pointers, newest first on each side.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct PointerLog {
    /// The commit the new pointer names (resolved: `HEAD` becomes its id).
    pub to: String,
    /// Commits the new pointer has and the old one does not (at most [`MAX_POINTER_COMMITS`]).
    pub added: Vec<PointerCommit>,
    /// Commits the old pointer had and the new one does not: it went back, or sideways.
    pub removed: Vec<PointerCommit>,
    /// More commits were added than listed.
    pub more_added: bool,
    /// More commits were removed than listed.
    pub more_removed: bool,
}

/// What can be told about a submodule's pointer change.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PointerChange {
    /// The submodule is not checked out here: there is no clone to read its commits from.
    NotCheckedOut,
    /// Its clone does not have one of the commits (not fetched yet, or gone).
    Missing,
    /// The commits between them.
    Log(PointerLog),
}

/// The folder of the submodule at `path` (relative, `/` separators) in `work_dir`. Refuses
/// absolute paths and paths that leave the work tree.
pub fn submodule_dir(work_dir: &Path, path: &str) -> Result<PathBuf, SubmoduleError> {
    let relative = Path::new(path);
    let inside = !path.is_empty()
        && relative
            .components()
            .all(|component| matches!(component, Component::Normal(_)));
    if !inside {
        return Err(SubmoduleError::InvalidPath(path.to_owned()));
    }
    Ok(path
        .split('/')
        .fold(work_dir.to_owned(), |dir, part| dir.join(part)))
}

/// The full id of `revision` as a commit in the repository at `dir`, if it has it.
async fn resolve(
    git: &Git,
    dir: &Path,
    revision: &str,
    cancel: &CancellationToken,
) -> Result<Option<String>, SubmoduleError> {
    let output = git
        .command()
        .current_dir(dir)
        .read_only()
        .args(["rev-parse", "--verify", "--quiet"])
        .revision(&format!("{revision}^{{commit}}"))?
        .output(cancel)
        .await?;
    let id = output.stdout_lossy().trim().to_owned();
    Ok((output.success() && !id.is_empty()).then_some(id))
}

/// The commits in `range`, newest first, and whether there were more than listed.
async fn commits(
    git: &Git,
    dir: &Path,
    range: &str,
    cancel: &CancellationToken,
) -> Result<(Vec<PointerCommit>, bool), SubmoduleError> {
    let output = git
        .command()
        .current_dir(dir)
        .read_only()
        .args(["log", "-z", "--format=%H%x00%an%x00%at%x00%s"])
        .option("--max-count", (MAX_POINTER_COMMITS + 1).to_string())
        .revision(range)?
        .output(cancel)
        .await?;
    if !output.success() {
        return Ok((Vec::new(), false));
    }
    let fields: Vec<&[u8]> = output.stdout.split(|byte| *byte == 0).collect();
    let mut listed: Vec<PointerCommit> = fields
        .chunks_exact(4)
        .map(|record| PointerCommit {
            id: String::from_utf8_lossy(record[0]).trim().to_owned(),
            author: String::from_utf8_lossy(record[1]).into_owned(),
            time: String::from_utf8_lossy(record[2])
                .trim()
                .parse()
                .unwrap_or(0),
            summary: String::from_utf8_lossy(record[3]).into_owned(),
        })
        .collect();
    let more = listed.len() > MAX_POINTER_COMMITS;
    listed.truncate(MAX_POINTER_COMMITS);
    Ok((listed, more))
}

/// The commits between `from` and `to` (commit ids, or `HEAD` for what the submodule has
/// checked out) in the submodule cloned at `dir`. Read-only.
pub async fn pointer_log(
    git: &Git,
    dir: &Path,
    from: &str,
    to: &str,
    cancel: &CancellationToken,
) -> Result<PointerChange, SubmoduleError> {
    // A submodule has a `.git` file (or folder) once checked out; without one git would read
    // the superproject instead.
    if !dir.join(".git").exists() {
        return Ok(PointerChange::NotCheckedOut);
    }
    let (Some(from), Some(to)) = (
        resolve(git, dir, from, cancel).await?,
        resolve(git, dir, to, cancel).await?,
    ) else {
        return Ok(PointerChange::Missing);
    };
    if from == to {
        return Ok(PointerChange::Log(PointerLog {
            to,
            ..PointerLog::default()
        }));
    }
    let (added, more_added) = commits(git, dir, &format!("{from}..{to}"), cancel).await?;
    let (removed, more_removed) = commits(git, dir, &format!("{to}..{from}"), cancel).await?;
    Ok(PointerChange::Log(PointerLog {
        to,
        added,
        removed,
        more_added,
        more_removed,
    }))
}
