//! Dropping changes to ignored files before they cause work.

use std::path::PathBuf;

/// An ignore check from the repository's `.gitignore` files, `info/exclude` and
/// `core.excludesFile`. Reads the index once per burst of changes. When the rules cannot be
/// read, nothing is treated as ignored (a status run too many is harmless).
pub fn gitignore_filter(repo: gix::ThreadSafeRepository) -> impl Fn(&[PathBuf]) -> Vec<bool> {
    move |files| {
        let repo = repo.to_thread_local();
        let Ok(index) = repo.index_or_empty() else {
            return vec![false; files.len()];
        };
        let Ok(mut excludes) = repo.excludes(
            &index,
            None,
            gix::worktree::stack::state::ignore::Source::WorktreeThenIdMappingIfNotSkipped,
        ) else {
            return vec![false; files.len()];
        };
        files
            .iter()
            .map(|file| {
                let mode = if repo.workdir().is_some_and(|dir| dir.join(file).is_dir()) {
                    Some(gix::index::entry::Mode::DIR)
                } else {
                    None
                };
                excludes
                    .at_path(file, mode)
                    .is_ok_and(|platform| platform.is_excluded())
            })
            .collect()
    }
}
