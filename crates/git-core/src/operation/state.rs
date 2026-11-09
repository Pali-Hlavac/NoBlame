//! Which operation is in progress in a repository (a merge stopped by conflicts, a rebase, a
//! cherry-pick, ...), read from the files git leaves in its folder, as `git status` does.

use std::path::Path;

use gix::state::InProgress;

/// The kind of operation in progress.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OperationKind {
    /// `git merge` (or a pull that merges).
    Merge,
    /// `git cherry-pick`, one commit or several.
    CherryPick,
    /// `git revert`, one commit or several.
    Revert,
    /// `git rebase`, interactive or not (or a pull that rebases).
    Rebase,
    /// `git am`, applying patches from a mailbox.
    ApplyMailbox,
    /// `git bisect`.
    Bisect,
}

/// An operation in progress, with what it works on.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Operation {
    /// What runs.
    pub kind: OperationKind,
    /// What it works on, in words: the merge message's first line (`Merge branch 'x'`), the
    /// commit being picked or reverted (`a1b2c3d4 Fix the parser`), the branch being rebased.
    pub detail: Option<String>,
    /// For a rebase or `git am`: the step it stopped at and how many there are.
    pub step: Option<(u32, u32)>,
}

/// The operation in progress in `repo`, if any. Blocking (reads a few small files).
pub fn operation_in_progress(repo: &gix::Repository) -> Option<Operation> {
    let git_dir = repo.path();
    let kind = match repo.state()? {
        InProgress::Merge => OperationKind::Merge,
        InProgress::CherryPick | InProgress::CherryPickSequence => OperationKind::CherryPick,
        InProgress::Revert | InProgress::RevertSequence => OperationKind::Revert,
        InProgress::Rebase | InProgress::RebaseInteractive => OperationKind::Rebase,
        InProgress::ApplyMailbox | InProgress::ApplyMailboxRebase => OperationKind::ApplyMailbox,
        InProgress::Bisect => OperationKind::Bisect,
    };
    let (detail, step) = match kind {
        OperationKind::Merge => (first_line(&git_dir.join("MERGE_MSG")), None),
        OperationKind::CherryPick => (commit_named(repo, "CHERRY_PICK_HEAD"), None),
        OperationKind::Revert => (commit_named(repo, "REVERT_HEAD"), None),
        OperationKind::Rebase | OperationKind::ApplyMailbox => rebase_progress(git_dir),
        OperationKind::Bisect => (None, None),
    };
    Some(Operation { kind, detail, step })
}

/// The first line of the file at `path`, when it has one.
fn first_line(path: &Path) -> Option<String> {
    let text = std::fs::read_to_string(path).ok()?;
    let line = text.lines().next()?.trim();
    (!line.is_empty()).then(|| line.to_owned())
}

/// `a1b2c3d4 Fix the parser` for the commit the pseudo-ref `name` (`CHERRY_PICK_HEAD`) names.
fn commit_named(repo: &gix::Repository, name: &str) -> Option<String> {
    let id = repo
        .find_reference(name)
        .ok()?
        .into_fully_peeled_id()
        .ok()?;
    let commit = repo.find_commit(id).ok()?;
    let summary = commit.message().ok()?.summary().to_string();
    let hex = id.to_hex_with_len(SHORT_ID_LEN).to_string();
    Some(format!("{hex} {summary}"))
}

/// Characters of a commit id shown in the banner.
const SHORT_ID_LEN: usize = 8;

/// The branch being rebased and the step: `rebase-merge/` (interactive and merge backend) keeps
/// `head-name`, `msgnum` and `end`; `rebase-apply/` (`git am`, apply backend) `next` and `last`.
fn rebase_progress(git_dir: &Path) -> (Option<String>, Option<(u32, u32)>) {
    for (folder, done, total) in [
        ("rebase-merge", "msgnum", "end"),
        ("rebase-apply", "next", "last"),
    ] {
        let dir = git_dir.join(folder);
        if !dir.is_dir() {
            continue;
        }
        let branch = first_line(&dir.join("head-name"))
            .map(|name| name.trim_start_matches("refs/heads/").to_owned())
            .filter(|name| name != "detached HEAD");
        let number = |file: &str| first_line(&dir.join(file))?.parse::<u32>().ok();
        let step = number(done).zip(number(total));
        return (branch, step);
    }
    (None, None)
}
