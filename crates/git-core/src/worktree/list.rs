//! Listing worktrees: `git worktree list --porcelain -z`, one record per worktree (fields
//! separated by NUL, records by an empty field), the main worktree first.

use std::path::{Path, PathBuf};

use tokio_util::sync::CancellationToken;

use crate::branch::{BranchError, accepted};
use crate::cli::Git;

/// One worktree of a repository.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Worktree {
    /// Its folder, with the platform's separators (git prints `/` on Windows too).
    pub path: PathBuf,
    /// The commit checked out (hex); `None` for a bare repository or an unborn branch.
    pub head: Option<String>,
    /// The branch checked out (`main`, not `refs/heads/main`); `None` when detached or bare.
    pub branch: Option<String>,
    /// HEAD is detached.
    pub detached: bool,
    /// The repository itself, when it is bare (then it has no files checked out).
    pub bare: bool,
    /// The main worktree (the first listed): it cannot be removed.
    pub main: bool,
    /// Locked (`git worktree lock`): git does not prune, move or remove it. The reason, or an
    /// empty text when none was given.
    pub locked: Option<String>,
    /// Its folder is gone, so `git worktree prune` would remove it; why, in git's words.
    pub prunable: Option<String>,
}

/// `path` as git printed it, with the platform's separators.
fn native(path: &str) -> PathBuf {
    Path::new(path).components().collect()
}

/// Parses the output of `git worktree list --porcelain -z`.
pub fn parse_worktrees(output: &[u8]) -> Vec<Worktree> {
    let mut worktrees = Vec::new();
    let mut current: Option<Worktree> = None;
    for field in output.split(|byte| *byte == 0) {
        let field = String::from_utf8_lossy(field);
        if field.is_empty() {
            worktrees.extend(current.take());
            continue;
        }
        let (key, value) = field.split_once(' ').unwrap_or((&field, ""));
        if key == "worktree" {
            worktrees.extend(current.take());
            current = Some(Worktree {
                path: native(value),
                main: worktrees.is_empty(),
                ..Worktree::default()
            });
            continue;
        }
        let Some(worktree) = current.as_mut() else {
            continue;
        };
        match key {
            "HEAD" => worktree.head = Some(value.to_owned()),
            "branch" => {
                worktree.branch = Some(value.strip_prefix("refs/heads/").unwrap_or(value).into());
            }
            "detached" => worktree.detached = true,
            "bare" => worktree.bare = true,
            "locked" => worktree.locked = Some(value.to_owned()),
            "prunable" => worktree.prunable = Some(value.to_owned()),
            _ => {}
        }
    }
    worktrees.extend(current);
    // An unborn branch has HEAD 0000…: no commit yet.
    for worktree in &mut worktrees {
        if worktree
            .head
            .as_deref()
            .is_some_and(|id| id.bytes().all(|b| b == b'0'))
        {
            worktree.head = None;
        }
    }
    worktrees
}

/// The worktrees of the repository at `dir`, the main one first. Read-only.
pub async fn list_worktrees(
    git: &Git,
    dir: &Path,
    cancel: &CancellationToken,
) -> Result<Vec<Worktree>, BranchError> {
    let output = git
        .command()
        .current_dir(dir)
        .read_only()
        .args(["worktree", "list", "--porcelain", "-z"])
        .output(cancel)
        .await?;
    accepted(&output)?;
    Ok(parse_worktrees(&output.stdout))
}

#[cfg(test)]
mod tests {
    use super::parse_worktrees;

    #[test]
    fn reads_each_record() {
        let zero = "0".repeat(40);
        let output = format!(
            "worktree /repo\0HEAD {a}\0branch refs/heads/main\0\0\
             worktree /wt/topic\0HEAD {b}\0detached\0locked moving disks\0\0\
             worktree /wt/gone\0HEAD {zero}\0branch refs/heads/new\0prunable gitdir file points to non-existent location\0\0",
            a = "a".repeat(40),
            b = "b".repeat(40),
        );
        let listed = parse_worktrees(output.as_bytes());
        assert_eq!(listed.len(), 3);
        assert!(listed[0].main && !listed[1].main);
        assert_eq!(listed[0].branch.as_deref(), Some("main"));
        assert!(listed[1].detached && listed[1].branch.is_none());
        assert_eq!(listed[1].locked.as_deref(), Some("moving disks"));
        assert_eq!(listed[2].head, None);
        assert!(listed[2].prunable.is_some());
    }

    #[test]
    fn a_bare_main_repository_has_no_head() {
        let listed = parse_worktrees(b"worktree /repo.git\0bare\0\0");
        assert!(listed[0].bare && listed[0].head.is_none());
    }
}
