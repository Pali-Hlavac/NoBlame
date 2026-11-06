//! `git push`: the command line for a push job, what it changed (from `--porcelain`), and what
//! to do when the remote refused.

use std::path::Path;

use crate::cli::{Git, GitCommand, GitError};

/// What to push.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PushWhat {
    /// A local branch to a branch on the remote (often the same name).
    Branch {
        /// The local branch (`feature/x`).
        local: String,
        /// The branch on the remote (`feature/x`).
        remote_branch: String,
        /// Make it the local branch's upstream (`--set-upstream`).
        set_upstream: bool,
        /// Also push annotated tags on the pushed commits (`--follow-tags`).
        follow_tags: bool,
        /// Replace the remote branch even when it has commits the local one lacks, but only if
        /// it is still where the user saw it (`--force-with-lease`); `None` pushes normally.
        force: Option<Lease>,
    },
    /// One tag.
    Tag(String),
    /// Delete a branch or tag on the remote: its full name there (`refs/heads/x`,
    /// `refs/tags/v1`).
    Delete(String),
}

/// Where the remote branch must still be for a force push to replace it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Lease {
    /// At this commit (full id): what the user was shown.
    At(gix::ObjectId),
    /// Nowhere: the branch must not exist on the remote yet.
    Absent,
}

/// A push to run.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PushOptions {
    /// The remote's name (`origin`).
    pub remote: String,
    /// What to push there.
    pub what: PushWhat,
}

/// `git push --progress --porcelain [options] <remote> <refspec>`. Names become full reference
/// names in the refspec, so they never read as options or force markers (`+`).
pub fn push_command(git: &Git, dir: &Path, options: &PushOptions) -> Result<GitCommand, GitError> {
    let mut command = git
        .command()
        .current_dir(dir)
        .args(["push", "--progress", "--porcelain"]);
    let refspec = match &options.what {
        PushWhat::Branch {
            local,
            remote_branch,
            set_upstream,
            follow_tags,
            force,
        } => {
            if *set_upstream {
                command = command.arg("--set-upstream");
            }
            if *follow_tags {
                command = command.arg("--follow-tags");
            }
            if let Some(lease) = force {
                let expected = match lease {
                    Lease::At(id) => id.to_string(),
                    Lease::Absent => String::new(),
                };
                command = command.option(
                    "--force-with-lease",
                    format!("refs/heads/{remote_branch}:{expected}"),
                );
            }
            format!("refs/heads/{local}:refs/heads/{remote_branch}")
        }
        PushWhat::Tag(tag) => format!("refs/tags/{tag}:refs/tags/{tag}"),
        PushWhat::Delete(reference) => {
            command = command.arg("--delete");
            reference.clone()
        }
    };
    command.revision(&options.remote)?.revision(&refspec)
}

/// What a push changed, from `--porcelain` lines: `<flag>\t<from>:<to>\t<summary>`.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct PushSummary {
    /// New branches or tags on the remote (`*`).
    pub new: u32,
    /// Moved forward (` `).
    pub updated: u32,
    /// Replaced (`+`).
    pub forced: u32,
    /// Deleted (`-`).
    pub deleted: u32,
    /// Already there (`=`).
    pub up_to_date: u32,
    /// Refused by git or the remote (`!`).
    pub rejected: u32,
}

/// Counts the reference lines of `git push --porcelain` standard output.
pub fn summarize_push(stdout: &str) -> PushSummary {
    let mut summary = PushSummary::default();
    for line in stdout.lines() {
        let mut fields = line.split('\t');
        let (Some(flag), Some(_), Some(_)) = (fields.next(), fields.next(), fields.next()) else {
            continue;
        };
        match flag {
            "*" => summary.new += 1,
            " " => summary.updated += 1,
            "+" => summary.forced += 1,
            "-" => summary.deleted += 1,
            "=" => summary.up_to_date += 1,
            "!" => summary.rejected += 1,
            _ => {}
        }
    }
    summary
}

/// `1 new, 2 updated`, or `Everything up to date`.
pub fn describe_push(summary: PushSummary) -> String {
    let parts: Vec<String> = [
        (summary.new, "new"),
        (summary.updated, "updated"),
        (summary.forced, "replaced"),
        (summary.deleted, "deleted"),
        (summary.rejected, "rejected"),
    ]
    .iter()
    .filter(|(count, _)| *count > 0)
    .map(|(count, word)| format!("{count} {word}"))
    .collect();
    if parts.is_empty() {
        "Everything up to date".to_owned()
    } else {
        parts.join(", ")
    }
}

/// A plain-language next step for a refused push, when git's output shows a known reason.
pub fn push_hint(output: &str) -> Option<&'static str> {
    let hints = [
        (
            "stale info",
            "The remote branch moved since your last fetch, so it was not replaced. Fetch, look at \
             what is new, then decide.",
        ),
        (
            "fetch first",
            "The remote has commits you don't have. Pull first, then push.",
        ),
        (
            "non-fast-forward",
            "The remote has commits you don't have. Pull first, then push (or push with force if \
             you mean to replace them).",
        ),
        (
            "remote rejected",
            "The server refused the push (a protected branch or a server hook); its message is in \
             the log.",
        ),
        (
            "does not appear to be a git repository",
            "There is no remote with that name, or its address is wrong.",
        ),
        (
            "src refspec",
            "There is nothing to push under that name (no such local branch or tag).",
        ),
    ];
    hints
        .iter()
        .find(|(needle, _)| output.contains(needle))
        .map(|(_, hint)| *hint)
}

#[cfg(test)]
mod tests {
    use super::{PushSummary, describe_push, push_hint, summarize_push};

    #[test]
    fn counts_porcelain_lines() {
        let stdout = "To https://example.com/repo.git\n\
                      *\trefs/heads/new:refs/heads/new\t[new branch]\n\
                      \x20\trefs/heads/main:refs/heads/main\t1a2b..3c4d\n\
                      +\trefs/heads/wip:refs/heads/wip\t1a2b...5e6f (forced update)\n\
                      -\t:refs/tags/old\t[deleted]\n\
                      =\trefs/tags/v1:refs/tags/v1\t[up to date]\n\
                      !\trefs/heads/x:refs/heads/x\t[rejected] (fetch first)\n\
                      Done\n";
        let summary = summarize_push(stdout);
        assert_eq!(
            summary,
            PushSummary {
                new: 1,
                updated: 1,
                forced: 1,
                deleted: 1,
                up_to_date: 1,
                rejected: 1,
            }
        );
        assert_eq!(
            describe_push(summary),
            "1 new, 1 updated, 1 replaced, 1 deleted, 1 rejected"
        );
        assert_eq!(
            describe_push(summarize_push("=\ta:b\t[up to date]\nDone\n")),
            "Everything up to date"
        );
    }

    #[test]
    fn explains_refusals() {
        assert!(
            push_hint("! refs/heads/x:refs/heads/x [rejected] (stale info)")
                .is_some_and(|hint| hint.contains("Fetch"))
        );
        assert!(push_hint("[rejected] (fetch first)").is_some_and(|hint| hint.contains("Pull")));
        assert_eq!(push_hint("Done"), None);
    }
}
