//! Upstreams of local branches and how far each is ahead of or behind its upstream.
//!
//! Listing every branch's upstream is one `git for-each-ref` without counting (about 0.1 s for
//! 5,000 branches). Counting walks history per branch, which for 5,000 diverged branches takes
//! 13–21 s, so [`ahead_behind`] counts only the branches it is given (the rows on screen).
//! Setting and unsetting use `git branch --set-upstream-to` and `--unset-upstream`.

use std::collections::HashSet;
use std::path::Path;

use tokio_util::sync::CancellationToken;

use super::{BranchError, accepted};
use crate::cli::{Git, GitOutput};

const HEADS: &str = "refs/heads/";

/// A local branch that has an upstream configured.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BranchUpstream {
    /// The branch name without `refs/heads/` (`feature/x`).
    pub branch: String,
    /// The upstream's full name: `refs/remotes/origin/x`, or `refs/heads/y` for a local one.
    pub upstream: String,
    /// The upstream is configured but does not exist (deleted on the remote and pruned, or
    /// never fetched).
    pub gone: bool,
}

/// How a branch compares with its upstream.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Tracking {
    /// Commits on the branch but not on the upstream, and the other way round.
    Counts {
        /// Commits to push.
        ahead: u32,
        /// Commits to pull.
        behind: u32,
    },
    /// The upstream is configured but does not exist.
    Gone,
}

/// Every local branch with an upstream, in git's order (by name). Read-only.
pub async fn upstreams(
    git: &Git,
    dir: &Path,
    cancel: &CancellationToken,
) -> Result<Vec<BranchUpstream>, BranchError> {
    let command = git
        .command()
        .current_dir(dir)
        .read_only()
        .arg("for-each-ref")
        .option("--format", "%(refname)%00%(upstream)")
        .args(["refs/heads", "refs/remotes"]);
    let output = command.output(cancel).await?;
    Ok(parse_upstreams(&checked(&output)?))
}

/// Ahead and behind counts for `branches` (names without `refs/heads/`); branches without an
/// upstream are left out. Read-only; the cost grows with the number of branches and how far
/// apart they are, so pass only the ones shown.
pub async fn ahead_behind(
    git: &Git,
    dir: &Path,
    branches: &[String],
    cancel: &CancellationToken,
) -> Result<Vec<(String, Tracking)>, BranchError> {
    if branches.is_empty() {
        return Ok(Vec::new());
    }
    let mut command = git
        .command()
        .current_dir(dir)
        .read_only()
        .arg("for-each-ref")
        .option(
            "--format",
            "%(refname)%00%(upstream)%00%(upstream:track,nobracket)",
        );
    for branch in branches {
        command = command.revision(&format!("{HEADS}{branch}"))?;
    }
    let output = command.output(cancel).await?;
    let wanted: HashSet<&str> = branches.iter().map(String::as_str).collect();
    parse_tracking(&checked(&output)?).map(|rows| {
        rows.into_iter()
            .filter(|(branch, _)| wanted.contains(branch.as_str()))
            .collect()
    })
}

/// Makes `upstream` (a full reference name: `refs/remotes/origin/x` or `refs/heads/y`) the
/// upstream of the local branch `branch`.
pub async fn set_upstream(
    git: &Git,
    dir: &Path,
    branch: &str,
    upstream: &str,
    cancel: &CancellationToken,
) -> Result<String, BranchError> {
    let command = git
        .command()
        .current_dir(dir)
        .arg("branch")
        .option("--set-upstream-to", upstream)
        .revision(branch)?;
    accepted(&command.output(cancel).await?)
}

/// Removes the upstream of the local branch `branch` (`branch.<name>.remote` and `.merge`).
pub async fn unset_upstream(
    git: &Git,
    dir: &Path,
    branch: &str,
    cancel: &CancellationToken,
) -> Result<String, BranchError> {
    let command = git
        .command()
        .current_dir(dir)
        .args(["branch", "--unset-upstream"])
        .revision(branch)?;
    accepted(&command.output(cancel).await?)
}

fn checked(output: &GitOutput) -> Result<String, BranchError> {
    if output.success() {
        Ok(output.stdout_lossy())
    } else {
        Err(BranchError::Rejected {
            output: output.combined(),
        })
    }
}

/// Lines of `refname NUL upstream`; local branches and remote branches both listed, so a
/// missing upstream can be told apart.
fn parse_upstreams(text: &str) -> Vec<BranchUpstream> {
    let rows: Vec<(&str, &str)> = text
        .lines()
        .filter_map(|line| line.split_once('\0'))
        .collect();
    let existing: HashSet<&str> = rows.iter().map(|(name, _)| *name).collect();
    rows.iter()
        .filter(|(_, upstream)| !upstream.is_empty())
        .filter_map(|(name, upstream)| {
            Some(BranchUpstream {
                branch: name.strip_prefix(HEADS)?.to_owned(),
                upstream: (*upstream).to_owned(),
                gone: !existing.contains(upstream),
            })
        })
        .collect()
}

/// Lines of `refname NUL upstream NUL track`, where track is `ahead 1, behind 2`, `ahead 1`,
/// `behind 2`, `gone`, or empty when both point at the same commit.
fn parse_tracking(text: &str) -> Result<Vec<(String, Tracking)>, BranchError> {
    let mut rows = Vec::new();
    for line in text.lines() {
        let mut fields = line.split('\0');
        let (Some(name), Some(upstream), Some(track)) =
            (fields.next(), fields.next(), fields.next())
        else {
            continue;
        };
        let Some(branch) = name.strip_prefix(HEADS) else {
            continue;
        };
        if upstream.is_empty() {
            continue;
        }
        let tracking = parse_track(track).ok_or_else(|| BranchError::Parse(line.to_owned()))?;
        rows.push((branch.to_owned(), tracking));
    }
    Ok(rows)
}

fn parse_track(track: &str) -> Option<Tracking> {
    if track == "gone" {
        return Some(Tracking::Gone);
    }
    let (mut ahead, mut behind) = (0, 0);
    for part in track.split(", ").filter(|part| !part.is_empty()) {
        let (word, count) = part.split_once(' ')?;
        let count = count.parse().ok()?;
        match word {
            "ahead" => ahead = count,
            "behind" => behind = count,
            _ => return None,
        }
    }
    Some(Tracking::Counts { ahead, behind })
}

#[cfg(test)]
mod tests {
    use super::{BranchUpstream, Tracking, parse_track, parse_tracking, parse_upstreams};

    #[test]
    fn reads_track_strings() {
        let counts = |ahead, behind| Some(Tracking::Counts { ahead, behind });
        assert_eq!(parse_track(""), counts(0, 0));
        assert_eq!(parse_track("ahead 3"), counts(3, 0));
        assert_eq!(parse_track("behind 12"), counts(0, 12));
        assert_eq!(parse_track("ahead 1, behind 2"), counts(1, 2));
        assert_eq!(parse_track("gone"), Some(Tracking::Gone));
        assert_eq!(parse_track("sideways 2"), None);
    }

    #[test]
    fn marks_missing_upstreams_gone() {
        let text = "refs/heads/main\0refs/remotes/origin/main\n\
                    refs/heads/old\0refs/remotes/origin/old\n\
                    refs/heads/solo\0\n\
                    refs/heads/local\0refs/heads/main\n\
                    refs/remotes/origin/main\0\n";
        let upstream = |branch: &str, upstream: &str, gone| BranchUpstream {
            branch: branch.into(),
            upstream: upstream.into(),
            gone,
        };
        assert_eq!(
            parse_upstreams(text),
            vec![
                upstream("main", "refs/remotes/origin/main", false),
                upstream("old", "refs/remotes/origin/old", true),
                upstream("local", "refs/heads/main", false),
            ]
        );
    }

    #[test]
    fn skips_branches_without_upstream() {
        let text = "refs/heads/a\0refs/remotes/o/a\0ahead 2\nrefs/heads/b\0\0\n";
        assert_eq!(
            parse_tracking(text).unwrap(),
            vec![(
                "a".to_owned(),
                Tracking::Counts {
                    ahead: 2,
                    behind: 0
                }
            )]
        );
    }
}
