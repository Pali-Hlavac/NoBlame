//! Submodules of a repository, nested recursively, for the Repositories module. Read with gix
//! from `.gitmodules` and the superproject's config; initializing and updating them runs the
//! `git` CLI (M7).

use std::path::Path;

use gix::bstr::ByteSlice;

/// Nesting deeper than this is not listed (and protects against cycles in broken setups).
pub const MAX_SUBMODULE_DEPTH: usize = 8;

/// Failures while listing submodules.
#[derive(Debug, thiserror::Error)]
pub enum SubmoduleError {
    /// gix could not read the configuration or a submodule.
    #[error("{0}")]
    Gix(String),
}

impl SubmoduleError {
    fn gix(error: impl std::fmt::Display) -> Self {
        Self::Gix(error.to_string())
    }
}

/// One submodule and, when it is checked out, its own submodules.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SubmoduleEntry {
    /// Name from `.gitmodules` (lossy if not UTF-8).
    pub name: String,
    /// Path relative to the superproject's work tree, with `/` separators.
    pub path: String,
    /// Absolute path of its work tree, to open it as a repository.
    pub work_dir: String,
    /// Configured URL, if readable.
    pub url: Option<String>,
    /// Cloned and checked out (`git submodule update --init` has run).
    pub initialized: bool,
    /// Its own submodules (only for initialized ones, up to [`MAX_SUBMODULE_DEPTH`]).
    pub children: Vec<SubmoduleEntry>,
}

/// The submodules of `repo`, recursively. A repository without `.gitmodules` gives an empty
/// list. A submodule that cannot be read is listed as not initialized rather than failing all.
pub fn list_submodules(repo: &gix::Repository) -> Result<Vec<SubmoduleEntry>, SubmoduleError> {
    collect(repo, 0)
}

fn collect(repo: &gix::Repository, depth: usize) -> Result<Vec<SubmoduleEntry>, SubmoduleError> {
    let Some(submodules) = repo.submodules().map_err(SubmoduleError::gix)? else {
        return Ok(Vec::new());
    };
    let work_tree = repo.workdir().map(Path::to_path_buf);
    let mut entries = Vec::new();
    for submodule in submodules {
        let path = submodule
            .path()
            .map(|path| path.to_str_lossy().into_owned())
            .unwrap_or_default();
        let initialized = submodule
            .state()
            .is_ok_and(|state| state.repository_exists && state.worktree_checkout);
        let child = if initialized && depth + 1 < MAX_SUBMODULE_DEPTH {
            submodule.open().ok().flatten()
        } else {
            None
        };
        let children = match &child {
            Some(child) => collect(child, depth + 1).unwrap_or_default(),
            None => Vec::new(),
        };
        // Join component by component: the path uses `/`, Windows paths use `\`, and the result
        // must equal the path a folder picker returns (it identifies the repository's tab).
        let work_dir = work_tree
            .as_ref()
            .map(|root| {
                path.split('/')
                    .fold(root.clone(), |dir, part| dir.join(part))
            })
            .map(|dir| std::path::absolute(&dir).unwrap_or(dir))
            .map(|dir| dir.to_string_lossy().into_owned())
            .unwrap_or_default();
        entries.push(SubmoduleEntry {
            name: submodule.name().to_str_lossy().into_owned(),
            url: submodule
                .url()
                .ok()
                .map(|url| url.to_bstring().to_str_lossy().into_owned()),
            path,
            work_dir,
            initialized,
            children,
        });
    }
    entries.sort_by(|a, b| a.path.cmp(&b.path));
    Ok(entries)
}
