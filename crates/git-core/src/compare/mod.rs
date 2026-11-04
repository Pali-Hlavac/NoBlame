//! Two commits compared: the files that differ between their trees, directly (`git diff A B`)
//! or since the commits' merge base (`git diff A...B`), and how many commits each one has that
//! the other lacks (`git rev-list --left-right --count A...B`). A commit compared with the
//! working tree is in `worktree.rs`.

use std::path::Path;

use gix::ObjectId;
use gix::bstr::ByteSlice;
use tokio_util::sync::CancellationToken;

use crate::cli::{Git, GitError};
use crate::diff::{ChangedFile, DiffError, tree_changes};

mod raw;
mod worktree;
use raw::parse_raw;
pub use worktree::compare_with_worktree;

/// Files returned at most for one comparison. Two releases of a large project can differ in
/// every file; the Linux kernel has about 90,000.
pub const MAX_COMPARED_FILES: usize = 100_000;

/// Failures while comparing.
#[derive(Debug, thiserror::Error)]
pub enum CompareError {
    /// The commits share no history, so they have no merge base.
    #[error("the commits have no common history")]
    NoMergeBase,
    /// gix could not read the commits or trees.
    #[error("{0}")]
    Gix(String),
    /// Diffing the trees failed.
    #[error(transparent)]
    Diff(#[from] DiffError),
    /// `git rev-list` failed or was cancelled.
    #[error(transparent)]
    Git(#[from] GitError),
    /// `git rev-list` printed something unexpected.
    #[error("unexpected `git rev-list` output: {0:?}")]
    Parse(String),
}

impl CompareError {
    fn gix(error: impl std::fmt::Display) -> Self {
        Self::Gix(error.to_string())
    }
}

/// The files that differ between two commits.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Comparison {
    /// The commit whose tree the target is compared with: the base itself, or the merge base.
    pub from: ObjectId,
    /// Sorted by path; at most [`MAX_COMPARED_FILES`].
    pub files: Vec<ChangedFile>,
    /// All files that differ, including those not listed.
    pub total: usize,
    /// Only renames of identical files were found (a partial clone lacks the contents).
    pub exact_renames_only: bool,
}

/// Commits that one side has and the other lacks.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct AheadBehind {
    /// Commits reachable from the target but not from the base.
    pub ahead: u64,
    /// Commits reachable from the base but not from the target.
    pub behind: u64,
}

/// The best common ancestor of `one` and `two`, as `git merge-base` finds it.
pub fn merge_base(
    repo: &gix::Repository,
    one: ObjectId,
    two: ObjectId,
) -> Result<ObjectId, CompareError> {
    repo.merge_base(one, two)
        .map_err(CompareError::gix)?
        .map(gix::Id::detach)
        .ok_or(CompareError::NoMergeBase)
}

/// The files that differ from `base` to `target`; with `since_merge_base`, from their merge base
/// to `target` instead (what `target` changed since the two split).
///
/// The list comes from `git diff --raw` (ADR 0023): its rename detection is about 20 times
/// faster than gix's on git.git. A partial clone uses gix and finds only renames of identical
/// files: git would try to download every missing file it compares, and fail.
pub async fn compare_commits(
    git: &Git,
    dir: &Path,
    repo: &gix::ThreadSafeRepository,
    base: ObjectId,
    target: ObjectId,
    since_merge_base: bool,
    cancel: &CancellationToken,
) -> Result<Comparison, CompareError> {
    let (from, partial) = starting_point(repo, base, target, since_merge_base).await?;
    if partial {
        let safe = repo.clone();
        return tokio::task::spawn_blocking(move || {
            tree_comparison(&safe.to_thread_local(), from, target)
        })
        .await
        .map_err(CompareError::gix)?;
    }
    let output = git
        .command()
        .current_dir(dir)
        .read_only()
        .no_lazy_fetch()
        .args(["diff", "--raw", "-z", "--no-abbrev", "--no-ext-diff"])
        .revision(&from.to_string())?
        .revision(&target.to_string())?
        .paths(std::iter::empty::<&Path>())
        .run(cancel)
        .await?;
    listed(from, &output.stdout, false)
}

/// The commit compared from (`base`, or its merge base with `target`), and whether the
/// repository is a partial clone.
async fn starting_point(
    repo: &gix::ThreadSafeRepository,
    base: ObjectId,
    target: ObjectId,
    since_merge_base: bool,
) -> Result<(ObjectId, bool), CompareError> {
    let safe = repo.clone();
    tokio::task::spawn_blocking(move || {
        let repo = safe.to_thread_local();
        let from = if since_merge_base {
            merge_base(&repo, base, target)?
        } else {
            base
        };
        Ok::<_, CompareError>((from, is_partial_clone(&repo)))
    })
    .await
    .map_err(CompareError::gix)?
}

/// The comparison `git diff --raw -z` printed, sorted by path and cut to [`MAX_COMPARED_FILES`].
fn listed(
    from: ObjectId,
    raw: &[u8],
    exact_renames_only: bool,
) -> Result<Comparison, CompareError> {
    let mut files = parse_raw(raw)?;
    files.sort_by(|a, b| a.path.cmp(&b.path));
    let total = files.len();
    files.truncate(MAX_COMPARED_FILES);
    Ok(Comparison {
        from,
        files,
        total,
        exact_renames_only,
    })
}

/// The comparison with gix, for partial clones.
fn tree_comparison(
    repo: &gix::Repository,
    from: ObjectId,
    target: ObjectId,
) -> Result<Comparison, CompareError> {
    let tree_of = |id: ObjectId| {
        repo.find_commit(id)
            .and_then(|commit| commit.tree())
            .map_err(CompareError::gix)
    };
    let (old, new) = (tree_of(from)?, tree_of(target)?);
    let changes = tree_changes(repo, Some(&old), &new, MAX_COMPARED_FILES)?;
    Ok(Comparison {
        from,
        files: changes.files,
        total: changes.total,
        exact_renames_only: changes.exact_renames_only,
    })
}

/// Whether objects may be missing locally: a remote is a promisor (`git clone --filter`).
fn is_partial_clone(repo: &gix::Repository) -> bool {
    let config = repo.config_snapshot();
    let file = config.plumbing();
    file.string("extensions.partialClone").is_some()
        || file.sections_by_name("remote").is_some_and(|mut remotes| {
            remotes.any(|remote| {
                remote.value("promisor").is_some_and(|value| {
                    // A key without a value (`promisor` alone) means true.
                    value.is_empty()
                        || gix::config::Boolean::try_from(value.as_bstr()).is_ok_and(|on| on.0)
                })
            })
        })
}

/// Counts the commits `target` has that `base` lacks, and the other way round, with
/// `git rev-list` (it uses the commit-graph file, so it stays fast on huge histories).
pub async fn count_ahead_behind(
    git: &Git,
    dir: &Path,
    base: ObjectId,
    target: ObjectId,
    cancel: &CancellationToken,
) -> Result<AheadBehind, CompareError> {
    let output = git
        .command()
        .current_dir(dir)
        .read_only()
        .no_lazy_fetch()
        .args(["rev-list", "--left-right", "--count"])
        .revision(&format!("{base}...{target}"))?
        .paths(std::iter::empty::<&Path>())
        .run(cancel)
        .await?;
    let text = String::from_utf8_lossy(&output.stdout);
    let parse = || CompareError::Parse(text.trim().to_owned());
    let mut counts = text.split_whitespace().map(str::parse::<u64>);
    match (counts.next(), counts.next()) {
        (Some(Ok(behind)), Some(Ok(ahead))) => Ok(AheadBehind { ahead, behind }),
        _ => Err(parse()),
    }
}
