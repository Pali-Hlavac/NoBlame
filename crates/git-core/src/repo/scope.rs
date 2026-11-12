//! Where a path given on the command line lies inside a repository's working tree, so task
//! windows can show only that folder or file (`noblame log src/`).

use std::path::{Component, Path};

/// A folder or file inside a working tree.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PathScope {
    /// Relative to the top of the working tree, with `/` between the parts (a pathspec git
    /// reads literally for plain names). Empty for the top itself.
    pub relative: String,
    /// It is a folder (or the top); `false` for files and paths that do not exist.
    pub is_folder: bool,
}

/// Where `path` lies inside `work_dir`, or `None` when it is outside (or in `.git`). Both
/// are compared as written first; when that fails (a symlink, other letter case on Windows,
/// `\\?\` prefixes), as the file system resolves them.
pub fn scope_in(work_dir: &Path, path: &Path) -> Option<PathScope> {
    let relative = if let Ok(relative) = path.strip_prefix(work_dir) {
        relative.to_path_buf()
    } else {
        let work_dir = std::fs::canonicalize(work_dir).ok()?;
        let path = std::fs::canonicalize(path).ok()?;
        path.strip_prefix(&work_dir).ok()?.to_path_buf()
    };
    let mut parts = Vec::new();
    for component in relative.components() {
        match component {
            Component::Normal(part) => parts.push(part.to_str()?),
            Component::CurDir => {}
            // `..`, roots and prefixes cannot follow a stripped prefix of an absolute path.
            _ => return None,
        }
    }
    if parts.first() == Some(&".git") {
        return None;
    }
    Some(PathScope {
        relative: parts.join("/"),
        is_folder: parts.is_empty() || path.is_dir(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn scopes_are_relative_with_forward_slashes() {
        let top = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(top.path().join("src/deep")).unwrap();
        std::fs::write(top.path().join("src/deep/a.rs"), "").unwrap();

        let folder = scope_in(top.path(), &top.path().join("src").join("deep")).unwrap();
        assert_eq!(folder.relative, "src/deep");
        assert!(folder.is_folder);

        let file = scope_in(top.path(), &top.path().join("src/deep/a.rs")).unwrap();
        assert_eq!(file.relative, "src/deep/a.rs");
        assert!(!file.is_folder);

        let whole = scope_in(top.path(), top.path()).unwrap();
        assert_eq!(whole.relative, "");
        assert!(whole.is_folder);
    }

    #[test]
    fn paths_outside_the_working_tree_have_no_scope() {
        let top = tempfile::tempdir().unwrap();
        let other = tempfile::tempdir().unwrap();
        assert_eq!(scope_in(top.path(), other.path()), None);
        assert_eq!(scope_in(top.path(), &top.path().join(".git")), None);
    }
}
