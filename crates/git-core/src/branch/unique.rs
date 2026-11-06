//! The commits only one branch or tag holds: what deleting it would leave unreachable (until
//! git's garbage collection removes them; the reflog of HEAD may still name them).

use std::path::Path;

use gix::ObjectId;
use tokio_util::sync::CancellationToken;

use super::{BranchError, RefNamespace};
use crate::cli::{Git, GitCommand, GitOutput};

/// How many of the newest such commits are listed by subject.
const NEWEST_LISTED: &str = "3";

/// Separates a commit's id from its subject in the `git log` format below.
const FIELD: char = '\u{1f}';

/// The commits that the reference holds and nothing else does.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UniqueCommits {
    /// How many there are.
    pub count: u32,
    /// The newest few (at most 3): full id and subject, newest first.
    pub newest: Vec<(String, String)>,
}

/// Commits reachable from `tip` (the commit of the reference `name` in `namespace`, as the
/// user saw it) and from no other local branch, remote branch, tag or HEAD (`head`, when it is
/// born). Read-only.
pub async fn unique_commits(
    git: &Git,
    dir: &Path,
    namespace: RefNamespace,
    name: &str,
    tip: ObjectId,
    head: Option<ObjectId>,
    cancel: &CancellationToken,
) -> Result<UniqueCommits, BranchError> {
    let count = range(
        git,
        dir,
        namespace,
        name,
        tip,
        head,
        &["rev-list", "--count"],
    )?;
    let count_output = count.output(cancel).await?;
    let count = checked(&count_output)?
        .trim()
        .parse::<u32>()
        .map_err(|_| BranchError::Parse(count_output.stdout_lossy()))?;
    if count == 0 {
        return Ok(UniqueCommits {
            count,
            newest: Vec::new(),
        });
    }
    let log = range(git, dir, namespace, name, tip, head, &["log", "-z"])?
        .option("--format", "%H%x1f%s")
        .option("--max-count", NEWEST_LISTED);
    let output = log.output(cancel).await?;
    Ok(UniqueCommits {
        count,
        newest: parse_log(&checked(&output)?),
    })
}

/// Commits reachable from `revision` but not from `not_in` (both validated revisions): what a
/// force push of `not_in` over `revision` takes off that branch. Read-only.
pub async fn commits_not_in(
    git: &Git,
    dir: &Path,
    revision: &str,
    not_in: &str,
    cancel: &CancellationToken,
) -> Result<UniqueCommits, BranchError> {
    let range = |command: &[&'static str]| {
        git.command()
            .current_dir(dir)
            .read_only()
            .args(command.iter().copied())
            .revision(revision)?
            .arg("--not")
            .revision(not_in)
    };
    let count_output = range(&["rev-list", "--count"])?.output(cancel).await?;
    let count = checked(&count_output)?
        .trim()
        .parse::<u32>()
        .map_err(|_| BranchError::Parse(count_output.stdout_lossy()))?;
    if count == 0 {
        return Ok(UniqueCommits {
            count,
            newest: Vec::new(),
        });
    }
    let log = range(&["log", "-z"])?
        .option("--format", "%H%x1f%s")
        .option("--max-count", NEWEST_LISTED);
    let output = log.output(cancel).await?;
    Ok(UniqueCommits {
        count,
        newest: parse_log(&checked(&output)?),
    })
}

/// `git <command> <tip> --not <every other ref> [HEAD]`, read-only. `--exclude` leaves out
/// the reference itself from the next `--branches`, `--tags` or `--remotes`.
fn range(
    git: &Git,
    dir: &Path,
    namespace: RefNamespace,
    name: &str,
    tip: ObjectId,
    head: Option<ObjectId>,
    command: &[&'static str],
) -> Result<GitCommand, BranchError> {
    let mut command = git
        .command()
        .current_dir(dir)
        .read_only()
        .args(command.iter().copied())
        .revision(&tip.to_string())?
        .arg("--not");
    for (kind, flag) in [
        (RefNamespace::Branch, "--branches"),
        (RefNamespace::Tag, "--tags"),
        (RefNamespace::Remote, "--remotes"),
    ] {
        if kind == namespace {
            command = command.option("--exclude", name);
        }
        command = command.arg(flag);
    }
    if let Some(head) = head {
        command = command.revision(&head.to_string())?;
    }
    Ok(command)
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

/// `id\x1fsubject` records separated by NUL.
fn parse_log(text: &str) -> Vec<(String, String)> {
    text.split('\0')
        .filter_map(|record| {
            let record = record.trim_start_matches('\n');
            let (id, subject) = record.split_once(FIELD)?;
            Some((id.to_owned(), subject.to_owned()))
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::parse_log;

    #[test]
    fn reads_ids_and_subjects() {
        assert_eq!(
            parse_log("aaa\u{1f}First\0bbb\u{1f}Second: with\u{1f}field\0"),
            vec![
                ("aaa".to_owned(), "First".to_owned()),
                ("bbb".to_owned(), "Second: with\u{1f}field".to_owned()),
            ]
        );
    }
}
