//! A submodule seen from the repository it is in (its superproject): which commit each of that
//! repository's local branches records for it, so the submodule's graph can label those commits
//! ("main" of the app sits here). Read with gix: one tree lookup per branch.

use std::path::PathBuf;

use gix::ObjectId;
use gix::bstr::{BString, ByteSlice};
use gix::object::tree::EntryKind;
use gix::refs::Category;

use super::SubmoduleError;

/// Local branches of the superproject read at most (each costs a tree lookup).
pub const MAX_SUPERPROJECT_BRANCHES: usize = 2_000;

/// What the superproject's branches record for one submodule.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SuperprojectPointers {
    /// The superproject's work tree.
    pub superproject: PathBuf,
    /// The submodule's path in it (`/` separators).
    pub path: BString,
    /// Each recorded commit with the branches recording it (short names, sorted), by commit.
    pub pointers: Vec<(ObjectId, Vec<String>)>,
}

fn gix_error(error: impl std::fmt::Display) -> SubmoduleError {
    SubmoduleError::Gix(error.to_string())
}

/// The repository whose work tree contains `work_dir` and records it as a submodule, with the
/// submodule's path in it.
fn find_superproject(work_dir: &std::path::Path) -> Option<(gix::Repository, BString)> {
    let mut dir = work_dir.parent();
    while let Some(candidate) = dir {
        if let Ok(outer) = gix::discover(candidate) {
            let path = outer
                .workdir()
                .and_then(|outer_work| work_dir.strip_prefix(outer_work).ok())
                .and_then(|relative| gix::path::into_bstr(relative).ok())
                .map(|path| gix::path::to_unix_separators_on_windows(path).into_owned());
            if let Some(path) = path {
                return Some((outer, path));
            }
        }
        dir = candidate.parent();
    }
    None
}

/// The commit `commit` records at `path`, if it records a submodule there.
fn pointer_at(commit: &gix::Commit<'_>, path: &BString) -> Option<ObjectId> {
    let tree = commit.tree().ok()?;
    let parts = path.split_str("/").map(BString::from);
    let entry = tree.lookup_entry(parts).ok()??;
    (entry.mode().kind() == EntryKind::Commit).then(|| entry.object_id())
}

/// For a submodule `repo`, what its superproject's local branches record for it; `None` when
/// it is not a submodule or no branch records it.
pub fn superproject_pointers(
    repo: &gix::Repository,
) -> Result<Option<SuperprojectPointers>, SubmoduleError> {
    if repo.kind() != gix::repository::Kind::Submodule {
        return Ok(None);
    }
    let Some(work_dir) = repo.workdir() else {
        return Ok(None);
    };
    let Some((outer, path)) = find_superproject(work_dir) else {
        return Ok(None);
    };
    let mut by_commit: Vec<(ObjectId, Vec<String>)> = Vec::new();
    let platform = outer.references().map_err(gix_error)?;
    let branches = platform.all().map_err(gix_error)?.filter_map(Result::ok);
    for mut reference in branches
        .filter(|reference| reference.name().category() == Some(Category::LocalBranch))
        .take(MAX_SUPERPROJECT_BRANCHES)
    {
        let name = reference.name().shorten().to_string();
        let Ok(commit) = reference.peel_to_commit() else {
            continue;
        };
        let Some(pointer) = pointer_at(&commit, &path) else {
            continue;
        };
        match by_commit.iter_mut().find(|(id, _)| *id == pointer) {
            Some((_, names)) => names.push(name),
            None => by_commit.push((pointer, vec![name])),
        }
    }
    if by_commit.is_empty() {
        return Ok(None);
    }
    for (_, names) in &mut by_commit {
        names.sort();
    }
    by_commit.sort_by_key(|(id, _)| *id);
    let superproject = outer
        .workdir()
        .map_or_else(|| outer.git_dir().to_path_buf(), PathBuf::from);
    Ok(Some(SuperprojectPointers {
        superproject,
        path,
        pointers: by_commit,
    }))
}
