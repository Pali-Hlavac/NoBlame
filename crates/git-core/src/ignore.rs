//! Ignoring untracked files: a pattern appended to the repository's `.gitignore` (shared through
//! commits) or to `info/exclude` (this clone only), and which untracked files a pattern would
//! hide. Global ignore files (`core.excludesFile`) are never touched.

use std::collections::HashSet;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};

use gix::bstr::{BString, ByteSlice};
use tokio_util::sync::CancellationToken;

use crate::cli::{Git, GitError};

/// Files named at most by a preview; the total counts them all.
pub const MAX_PREVIEW_FILES: usize = 200;

/// Where a pattern is written.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IgnoreFile {
    /// `.gitignore` at the top of the working tree, shared with everyone through commits.
    Shared,
    /// `info/exclude` in the repository's (common) git folder: only this clone.
    Local,
}

/// Failures while ignoring files.
#[derive(Debug, thiserror::Error)]
pub enum IgnoreError {
    /// The pattern cannot be written as one ignore rule; the text says why.
    #[error("{0}")]
    Invalid(&'static str),
    /// The repository has no working tree.
    #[error("the repository has no working tree")]
    Bare,
    /// Writing the ignore file failed.
    #[error("could not write {path}: {source}")]
    Write {
        /// The ignore file.
        path: PathBuf,
        /// What the system reported.
        source: std::io::Error,
    },
    /// `git ls-files` failed or was cancelled.
    #[error(transparent)]
    Git(#[from] GitError),
}

/// The untracked files a pattern would hide.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct IgnorePreview {
    /// Sorted, at most [`MAX_PREVIEW_FILES`].
    pub files: Vec<BString>,
    /// All of them.
    pub total: usize,
}

/// Refuses text that is not one ignore rule: empty, several lines, a comment, or ending in a
/// space git would drop.
pub fn check_pattern(pattern: &str) -> Result<(), IgnoreError> {
    if pattern.trim().is_empty() {
        return Err(IgnoreError::Invalid("Type a pattern."));
    }
    if pattern.contains(['\n', '\r', '\0']) {
        return Err(IgnoreError::Invalid("A pattern is a single line."));
    }
    if pattern.starts_with('#') {
        return Err(IgnoreError::Invalid(
            "A line starting with # is a comment; write \\# for a name that starts with #.",
        ));
    }
    if pattern.ends_with(' ') && !pattern.ends_with("\\ ") {
        return Err(IgnoreError::Invalid(
            "Git drops spaces at the end of a pattern; write \\ before the last one to keep it.",
        ));
    }
    Ok(())
}

/// The file `which` names in `repo`.
pub fn ignore_file_path(repo: &gix::Repository, which: IgnoreFile) -> Result<PathBuf, IgnoreError> {
    match which {
        IgnoreFile::Shared => repo
            .workdir()
            .map(|dir| dir.join(".gitignore"))
            .ok_or(IgnoreError::Bare),
        // Linked worktrees share it with the main one.
        IgnoreFile::Local => Ok(repo.common_dir().join("info").join("exclude")),
    }
}

/// Appends `pattern` as a line of the ignore file at `path`, creating the file (and its folder)
/// when needed and keeping its line endings. Returns `false` when the line is already there.
pub fn add_ignore_pattern(path: &Path, pattern: &str) -> Result<bool, IgnoreError> {
    check_pattern(pattern)?;
    let failed = |source| IgnoreError::Write {
        path: path.to_owned(),
        source,
    };
    let existing = match fs::read(path) {
        Ok(bytes) => bytes,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Vec::new(),
        Err(error) => return Err(failed(error)),
    };
    let present = existing
        .lines()
        .any(|line| line.trim_end_with(|c| c == '\r') == pattern.as_bytes());
    if present {
        return Ok(false);
    }
    let newline: &[u8] = if existing.find(b"\r\n").is_some() {
        b"\r\n"
    } else {
        b"\n"
    };
    let mut text = Vec::with_capacity(pattern.len() + 2 * newline.len());
    if !existing.is_empty() && !existing.ends_with(b"\n") {
        text.extend_from_slice(newline);
    }
    text.extend_from_slice(pattern.as_bytes());
    text.extend_from_slice(newline);
    if let Some(folder) = path.parent() {
        fs::create_dir_all(folder).map_err(failed)?;
    }
    OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)
        .and_then(|mut file| file.write_all(&text))
        .map_err(failed)?;
    Ok(true)
}

/// The untracked files listed now (not ignored) that `pattern` would hide, as if it were given
/// on git's command line (it then takes precedence over a `!` rule in a deeper `.gitignore`).
pub async fn files_hidden_by(
    git: &Git,
    work_dir: &Path,
    pattern: &str,
    cancel: &CancellationToken,
) -> Result<IgnorePreview, IgnoreError> {
    check_pattern(pattern)?;
    let list = || {
        git.command().current_dir(work_dir).read_only().args([
            "ls-files",
            "-z",
            "--others",
            "--exclude-standard",
        ])
    };
    let visible = list().run(cancel).await?.stdout;
    // Ignored folders come as one `folder/` entry instead of all their files.
    let ignored = list()
        .args(["--ignored", "--directory"])
        .option("--exclude", pattern)
        .run(cancel)
        .await?
        .stdout;
    let ignored: HashSet<&[u8]> = entries(&ignored).collect();
    let hidden_by = |path: &[u8]| {
        ignored.contains(path)
            || path
                .iter()
                .enumerate()
                .any(|(end, &byte)| byte == b'/' && ignored.contains(&path[..=end]))
    };
    let mut files: Vec<BString> = entries(&visible)
        .filter(|path| hidden_by(path))
        .map(BString::from)
        .collect();
    files.sort();
    let total = files.len();
    files.truncate(MAX_PREVIEW_FILES);
    Ok(IgnorePreview { files, total })
}

/// The NUL-separated paths `git ls-files -z` printed.
fn entries(output: &[u8]) -> impl Iterator<Item = &[u8]> {
    output
        .split(|&byte| byte == 0)
        .filter(|path| !path.is_empty())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn refuses_what_is_not_one_rule() {
        for bad in ["", "  ", "a\nb", "#notes", "trailing "] {
            assert!(check_pattern(bad).is_err(), "{bad:?}");
        }
        for good in ["*.log", "/build/", "\\#notes", "name\\ ", "!keep.log"] {
            assert!(check_pattern(good).is_ok(), "{good:?}");
        }
    }

    #[test]
    fn appends_once_and_keeps_line_endings() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("info").join("exclude");
        assert!(add_ignore_pattern(&path, "*.log").unwrap());
        assert!(!add_ignore_pattern(&path, "*.log").unwrap());
        assert_eq!(fs::read_to_string(&path).unwrap(), "*.log\n");

        let crlf = dir.path().join(".gitignore");
        fs::write(&crlf, "target/\r\nnode_modules/").unwrap();
        assert!(add_ignore_pattern(&crlf, "/dist/").unwrap());
        assert!(!add_ignore_pattern(&crlf, "target/").unwrap());
        assert_eq!(
            fs::read_to_string(&crlf).unwrap(),
            "target/\r\nnode_modules/\r\n/dist/\r\n"
        );
    }
}
