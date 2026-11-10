//! Bisecting: marking commits good, bad or skipped (`git bisect`), and where a bisect stands:
//! its marks (`refs/bisect/*`), the commit being tested and the first bad commit once found.
//! How many are left comes only with a mark (git prints it): counting again
//! (`git rev-list --bisect-vars`) took 73 s over 326,000 commits of the Linux kernel. Stopping it is a sequence step (`git bisect reset`, `sequence.rs`).

use std::path::Path;

use tokio_util::sync::CancellationToken;

use super::OperationError;
use crate::cli::{Git, GitOutput};

/// How a commit is marked.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BisectMark {
    /// It does not have the problem.
    Good,
    /// It has the problem.
    Bad,
    /// It cannot be tested (it does not build, for example).
    Skip,
}

impl BisectMark {
    fn verb(self) -> &'static str {
        match self {
            Self::Good => "good",
            Self::Bad => "bad",
            Self::Skip => "skip",
        }
    }
}

/// Where a bisect stands after a mark.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum BisectOutcome {
    /// It still needs a good commit, a bad one, or both.
    Waiting,
    /// git checked out the next commit to test.
    Testing {
        /// The commit checked out (full id; empty if git did not name it).
        commit: String,
        /// Commits left to test after this one.
        remaining: u32,
        /// About how many more marks that takes.
        steps: u32,
    },
    /// The first bad commit is found (full id).
    Found {
        /// Its full id.
        commit: String,
    },
    /// Only skipped commits are left: the first bad one is among them.
    OnlySkipped,
}

/// A commit named by the bisect.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BisectCommit {
    /// Full id.
    pub id: String,
    /// The first line of its message (lossy UTF-8).
    pub summary: String,
}

/// A bisect in progress.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct BisectState {
    /// The commit marked bad (full id).
    pub bad: Option<String>,
    /// The commits marked good.
    pub good: Vec<String>,
    /// The commits skipped.
    pub skipped: Vec<String>,
    /// The first bad commit, once found.
    pub first_bad: Option<BisectCommit>,
    /// The commit checked out to test (HEAD), until the first bad one is found.
    pub testing: Option<BisectCommit>,
    /// What HEAD was before the bisect started (a branch name or a commit): where stopping
    /// returns to.
    pub started_from: Option<String>,
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

/// Whether a bisect is in progress in the work tree whose git folder is `git_dir`.
pub fn bisecting(git_dir: &Path) -> bool {
    git_dir.join("BISECT_START").is_file()
}

/// Reads git's words after a mark.
pub fn bisect_outcome(output: &str) -> BisectOutcome {
    let mut lines = output.lines();
    while let Some(line) = lines.next() {
        // `<id> is the first bad commit` (git 2.56 quotes the term: `first 'bad' commit`).
        if let Some((id, rest)) = line.split_once(" is the first ")
            && rest.ends_with("commit")
            && !id.contains(' ')
        {
            return BisectOutcome::Found {
                commit: id.to_owned(),
            };
        }
        if line.contains("only 'skip'ped commits left") {
            return BisectOutcome::OnlySkipped;
        }
        if let Some(rest) = line.strip_prefix("Bisecting: ") {
            let numbers: Vec<u32> = rest
                .split(|c: char| !c.is_ascii_digit())
                .filter_map(|part| part.parse().ok())
                .collect();
            if let [remaining, steps, ..] = numbers[..] {
                // The next line names the commit checked out: `[<id>] subject`.
                let commit = lines
                    .next()
                    .and_then(|next| next.strip_prefix('['))
                    .and_then(|next| next.split_once(']'))
                    .map(|(id, _)| id.to_owned())
                    .unwrap_or_default();
                return BisectOutcome::Testing {
                    commit,
                    remaining,
                    steps,
                };
            }
        }
    }
    BisectOutcome::Waiting
}

/// Marks `commit` (HEAD when `None`) as good, bad or skipped in the work tree at `dir`, starting
/// a bisect first when none runs (`git_dir` is that work tree's git folder). git checks out the
/// next commit to test once it has a good and a bad one. Returns where it stands and what git
/// printed; refused (`Rejected`) when git refuses, for example local changes in the way.
pub async fn bisect_mark(
    git: &Git,
    dir: &Path,
    git_dir: &Path,
    mark: BisectMark,
    commit: Option<&str>,
    cancel: &CancellationToken,
) -> Result<(BisectOutcome, String), OperationError> {
    if !bisecting(git_dir) {
        if mark == BisectMark::Skip {
            return Err(OperationError::NotApplicable(
                "No bisect is running: mark a bad and a good commit first.".to_owned(),
            ));
        }
        let start = git.command().current_dir(dir).args(["bisect", "start"]);
        checked(start.output(cancel).await?)?;
    }
    let mut command = git.command().current_dir(dir).args(["bisect", mark.verb()]);
    if let Some(commit) = commit {
        command = command.revision(commit)?;
    }
    let text = checked(command.output(cancel).await?)?.combined();
    Ok((bisect_outcome(&text), text))
}

/// Where the bisect in the work tree at `dir` stands; `None` when none runs. Read-only.
pub async fn bisect_state(
    git: &Git,
    dir: &Path,
    git_dir: &Path,
    cancel: &CancellationToken,
) -> Result<Option<BisectState>, OperationError> {
    if !bisecting(git_dir) {
        return Ok(None);
    }
    let mut state = BisectState {
        started_from: std::fs::read_to_string(git_dir.join("BISECT_START"))
            .ok()
            .map(|text| text.trim().to_owned())
            .filter(|text| !text.is_empty()),
        first_bad: first_bad(git_dir),
        ..BisectState::default()
    };
    let refs = git
        .command()
        .current_dir(dir)
        .read_only()
        .args([
            "for-each-ref",
            "--format=%(objectname) %(refname)",
            "refs/bisect/",
        ])
        .output(cancel)
        .await?;
    for line in checked(refs)?.stdout_lossy().lines() {
        let Some((id, name)) = line.split_once(' ') else {
            continue;
        };
        let id = id.to_owned();
        match name.strip_prefix("refs/bisect/") {
            Some("bad") => state.bad = Some(id),
            Some(rest) if rest.starts_with("good-") => state.good.push(id),
            Some(rest) if rest.starts_with("skip-") => state.skipped.push(id),
            _ => {}
        }
    }
    if state.first_bad.is_none() {
        let head = git
            .command()
            .current_dir(dir)
            .read_only()
            .args(["log", "-1", "--format=%H%x00%s", "HEAD"])
            .output(cancel)
            .await?;
        state.testing = head
            .success()
            .then(|| head.stdout_lossy())
            .and_then(|text| {
                let (id, summary) = text.trim_end().split_once('\0')?;
                Some(BisectCommit {
                    id: id.to_owned(),
                    summary: summary.to_owned(),
                })
            });
    }
    Ok(Some(state))
}

/// The first bad commit, from the bisect log (`# first bad commit: [<id>] subject`).
fn first_bad(git_dir: &Path) -> Option<BisectCommit> {
    let log = std::fs::read_to_string(git_dir.join("BISECT_LOG")).ok()?;
    log.lines().rev().find_map(|line| {
        let rest = line.strip_prefix("# first ")?;
        let (_, after) = rest.split_once("commit: [")?;
        let (id, summary) = after.split_once(']')?;
        Some(BisectCommit {
            id: id.to_owned(),
            summary: summary.trim().to_owned(),
        })
    })
}

#[cfg(test)]
mod tests {
    use super::{BisectOutcome, bisect_outcome};

    #[test]
    fn reads_what_git_said() {
        assert_eq!(
            bisect_outcome("status: waiting for good commit(s), bad commit known"),
            BisectOutcome::Waiting
        );
        assert_eq!(
            bisect_outcome(
                "Bisecting: 4 revisions left to test after this (roughly 2 steps)\n[e1] c5"
            ),
            BisectOutcome::Testing {
                commit: "e1".to_owned(),
                remaining: 4,
                steps: 2
            }
        );
        let found = BisectOutcome::Found {
            commit: "e801088ad".to_owned(),
        };
        assert_eq!(
            bisect_outcome("e801088ad is the first 'bad' commit\ncommit e801"),
            found
        );
        assert_eq!(bisect_outcome("e801088ad is the first bad commit"), found);
        assert_eq!(
            bisect_outcome(
                "There are only 'skip'ped commits left to test.\nThe first bad commit could be any of:"
            ),
            BisectOutcome::OnlySkipped
        );
    }
}
