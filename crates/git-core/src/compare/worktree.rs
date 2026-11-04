//! A commit compared with the working tree, as `git diff <commit>` lists it: the tracked files
//! and those added to the index, not untracked ones. The new side of a file is the file on disk,
//! so it has no new id: git gives the index's id, none, or (when looking for renames) the hash of
//! contents it never stored, so the contents are read from the file instead.

use std::path::Path;

use gix::ObjectId;
use tokio_util::sync::CancellationToken;

use super::{CompareError, Comparison, listed, starting_point};
use crate::cli::Git;

/// The files that differ from `base` to the working tree at `work_dir`; with
/// `since_merge_base`, from the merge base of `base` and `head` instead (what the working tree
/// changed since its branch split from `base`).
///
/// A partial clone looks for renames of identical files only (`-M100%`): finding edited, moved
/// files would make git read old contents that may be missing locally.
pub async fn compare_with_worktree(
    git: &Git,
    work_dir: &Path,
    repo: &gix::ThreadSafeRepository,
    base: ObjectId,
    head: ObjectId,
    since_merge_base: bool,
    cancel: &CancellationToken,
) -> Result<Comparison, CompareError> {
    let (from, partial) = starting_point(repo, base, head, since_merge_base).await?;
    let mut command = git
        .command()
        .current_dir(work_dir)
        .read_only()
        .no_lazy_fetch()
        .args(["diff", "--raw", "-z", "--no-abbrev", "--no-ext-diff"]);
    if partial {
        command = command.arg("-M100%");
    }
    let output = command
        .revision(&from.to_string())?
        .paths(std::iter::empty::<&Path>())
        .run(cancel)
        .await?;
    let mut comparison = listed(from, &output.stdout, partial)?;
    for file in &mut comparison.files {
        // A submodule's new side is the commit checked out in it, which git reads.
        if !file.submodule {
            file.new_id = None;
        }
    }
    Ok(comparison)
}
