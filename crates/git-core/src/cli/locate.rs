//! Finding the `git` executable.
//!
//! Order: the `NOBLAME_GIT` override, then every directory on `PATH`, then well-known install
//! locations (GUI apps on macOS get a minimal `PATH`, and Windows installs are not always on
//! it). On macOS `/usr/bin/git` is only a shim for the Xcode Command Line Tools, so a
//! Homebrew or MacPorts git is preferred over it.

use std::ffi::OsString;
use std::path::{Path, PathBuf};

use super::GitError;

/// Environment variable that points NoBlame at a specific git executable.
pub const GIT_OVERRIDE_ENV: &str = "NOBLAME_GIT";

/// File name of the executable on this platform.
#[cfg(windows)]
const GIT_FILE_NAME: &str = "git.exe";
#[cfg(not(windows))]
const GIT_FILE_NAME: &str = "git";

/// The macOS system shim; only usable when the Command Line Tools are installed.
#[cfg(target_os = "macos")]
const MACOS_SHIM_DIR: &str = "/usr/bin";

/// Finds git using the real environment.
pub fn locate_git() -> Result<PathBuf, GitError> {
    let override_path = std::env::var_os(GIT_OVERRIDE_ENV).map(PathBuf::from);
    let path_var = std::env::var_os("PATH").unwrap_or_default();
    locate_in(override_path, &search_dirs(&path_var))
}

/// Returns the override if it is a file, else the first directory that contains git.
pub fn locate_in(override_path: Option<PathBuf>, dirs: &[PathBuf]) -> Result<PathBuf, GitError> {
    let mut searched = Vec::new();
    if let Some(path) = override_path {
        if path.is_file() {
            return Ok(path);
        }
        searched.push(path);
    }
    for dir in dirs {
        let candidate = dir.join(GIT_FILE_NAME);
        if candidate.is_file() {
            return Ok(candidate);
        }
        searched.push(candidate);
    }
    Err(GitError::NotFound { searched })
}

/// `PATH` entries followed by the platform's well-known directories, without duplicates.
pub fn search_dirs(path_var: &OsString) -> Vec<PathBuf> {
    let mut dirs: Vec<PathBuf> = std::env::split_paths(path_var)
        .filter(|dir| !dir.as_os_str().is_empty())
        .collect();
    dirs.extend(well_known_dirs());
    let mut unique = Vec::with_capacity(dirs.len());
    for dir in dirs {
        if !unique.iter().any(|seen: &PathBuf| same_dir(seen, &dir)) {
            unique.push(dir);
        }
    }
    prefer_real_git(&mut unique);
    unique
}

#[cfg(windows)]
fn same_dir(a: &Path, b: &Path) -> bool {
    a.as_os_str().eq_ignore_ascii_case(b.as_os_str())
}

#[cfg(not(windows))]
fn same_dir(a: &Path, b: &Path) -> bool {
    a == b
}

#[cfg(target_os = "macos")]
fn prefer_real_git(dirs: &mut [PathBuf]) {
    // A stable sort keeps the original order apart from moving the shim to the end.
    dirs.sort_by_key(|dir| dir == Path::new(MACOS_SHIM_DIR));
}

#[cfg(not(target_os = "macos"))]
fn prefer_real_git(_dirs: &mut [PathBuf]) {}

#[cfg(windows)]
fn well_known_dirs() -> Vec<PathBuf> {
    let under =
        |var: &str, rest: &str| std::env::var_os(var).map(|base| Path::new(&base).join(rest));
    [
        under("ProgramFiles", r"Git\cmd"),
        under("ProgramFiles(x86)", r"Git\cmd"),
        under("LOCALAPPDATA", r"Programs\Git\cmd"),
    ]
    .into_iter()
    .flatten()
    .collect()
}

#[cfg(target_os = "macos")]
fn well_known_dirs() -> Vec<PathBuf> {
    [
        "/opt/homebrew/bin",
        "/usr/local/bin",
        "/opt/local/bin",
        MACOS_SHIM_DIR,
    ]
    .into_iter()
    .map(PathBuf::from)
    .collect()
}

#[cfg(not(any(windows, target_os = "macos")))]
fn well_known_dirs() -> Vec<PathBuf> {
    ["/usr/bin", "/usr/local/bin", "/bin"]
        .into_iter()
        .map(PathBuf::from)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn dir_with_git() -> tempfile::TempDir {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join(GIT_FILE_NAME), b"").unwrap();
        dir
    }

    #[test]
    fn override_wins_when_it_exists() {
        let found = dir_with_git();
        let override_dir = dir_with_git();
        let override_path = override_dir.path().join(GIT_FILE_NAME);
        let result = locate_in(Some(override_path.clone()), &[found.path().to_path_buf()]);
        assert_eq!(result.unwrap(), override_path);
    }

    #[test]
    fn missing_override_falls_back_to_search_dirs() {
        let found = dir_with_git();
        let result = locate_in(Some("does/not/exist".into()), &[found.path().to_path_buf()]);
        assert_eq!(result.unwrap(), found.path().join(GIT_FILE_NAME));
    }

    #[test]
    fn first_matching_dir_wins_and_misses_are_reported() {
        let empty = tempfile::tempdir().unwrap();
        let (first, second) = (dir_with_git(), dir_with_git());
        let dirs = [empty.path(), first.path(), second.path()].map(Path::to_path_buf);
        assert_eq!(
            locate_in(None, &dirs).unwrap(),
            first.path().join(GIT_FILE_NAME)
        );

        let Err(GitError::NotFound { searched }) = locate_in(None, &dirs[..1]) else {
            panic!("expected NotFound");
        };
        assert_eq!(searched, vec![empty.path().join(GIT_FILE_NAME)]);
    }

    #[test]
    fn search_dirs_skip_empty_entries_and_duplicates() {
        let a = tempfile::tempdir().unwrap();
        let joined = std::env::join_paths([a.path(), Path::new(""), a.path()]).unwrap();
        let dirs = search_dirs(&joined);
        assert_eq!(dirs.iter().filter(|dir| *dir == a.path()).count(), 1);
        assert!(dirs.iter().all(|dir| !dir.as_os_str().is_empty()));
    }
}
