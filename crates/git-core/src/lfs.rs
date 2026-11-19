//! Git LFS through the `git lfs` command: whether it is installed, the repository's LFS files with
//! whether each is checked out with its content or only as a pointer (`git lfs ls-files`), and
//! the locks on the LFS server (`git lfs locks`, `lock`, `unlock`; they need a remote with an LFS
//! server). Downloading contents (`git lfs pull`) is built as a command for a background job.

use std::path::Path;

use serde::Deserialize;
use tokio_util::sync::CancellationToken;

use crate::cli::{Git, GitCommand, GitError};

/// Most LFS files listed; the rest are counted.
pub const MAX_LFS_FILES: usize = 20_000;

/// Failures of Git LFS commands.
#[derive(Debug, thiserror::Error)]
pub enum LfsError {
    /// git could not run, or a value cannot be passed to it.
    #[error(transparent)]
    Git(#[from] GitError),
    /// git-lfs refused or failed; `output` is what it said.
    #[error("{output}")]
    Rejected {
        /// Standard output and standard error, trimmed.
        output: String,
    },
    /// git-lfs answered something this version does not understand.
    #[error("git lfs answered something unexpected: {0}")]
    Parse(String),
}

/// A file stored in Git LFS, as the commit checked out has it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LfsFile {
    /// Its path, `/` separated.
    pub path: String,
    /// Its size as git-lfs words it (`3.0 KB`).
    pub size: String,
    /// The object id (sha256, hex).
    pub oid: String,
    /// Whether the working tree has its content; `false`: only the pointer (not downloaded).
    pub has_content: bool,
}

/// LFS in a repository.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LfsState {
    /// `git lfs version`'s answer (`git-lfs/3.8.0 …`); `None` when git-lfs is not installed.
    pub version: Option<String>,
    /// Its LFS files (at most [`MAX_LFS_FILES`]).
    pub files: Vec<LfsFile>,
    /// How many there are.
    pub total: usize,
}

/// A lock on an LFS server.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
pub struct LfsLock {
    /// The server's id for it.
    pub id: String,
    /// The locked file.
    pub path: String,
    /// Who holds it.
    #[serde(default)]
    pub owner: Option<LfsOwner>,
    /// When it was taken (RFC 3339).
    #[serde(default)]
    pub locked_at: String,
}

/// Who holds a lock.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
pub struct LfsOwner {
    /// Their name on the server.
    pub name: String,
}

fn lfs(git: &Git, dir: &Path) -> GitCommand {
    git.command().current_dir(dir).arg("lfs")
}

async fn run(command: GitCommand, cancel: &CancellationToken) -> Result<String, LfsError> {
    let output = command.output(cancel).await?;
    if output.success() {
        Ok(output.stdout_lossy())
    } else {
        Err(LfsError::Rejected {
            output: output.combined(),
        })
    }
}

/// The lines of `git lfs ls-files --long --size`: `<oid> <*|-> <path> (<size>)`.
pub fn parse_lfs_files(output: &str) -> Vec<LfsFile> {
    output
        .lines()
        .filter_map(|line| {
            let (oid, rest) = line.split_once(' ')?;
            let (marker, rest) = rest.split_once(' ')?;
            let (path, size) = rest.rsplit_once(" (")?;
            Some(LfsFile {
                path: path.to_owned(),
                size: size.trim_end_matches(')').to_owned(),
                oid: oid.to_owned(),
                has_content: marker == "*",
            })
        })
        .collect()
}

/// Whether git-lfs is installed, and the LFS files of the commit checked out in `dir`.
pub async fn lfs_state(
    git: &Git,
    dir: &Path,
    cancel: &CancellationToken,
) -> Result<LfsState, LfsError> {
    let version = git
        .command()
        .read_only()
        .args(["lfs", "version"])
        .output(cancel)
        .await?;
    if !version.success() {
        return Ok(LfsState {
            version: None,
            files: Vec::new(),
            total: 0,
        });
    }
    let listed = run(
        lfs(git, dir)
            .read_only()
            .args(["ls-files", "--long", "--size"]),
        cancel,
    )
    .await?;
    let mut files = parse_lfs_files(&listed);
    let total = files.len();
    files.truncate(MAX_LFS_FILES);
    Ok(LfsState {
        version: Some(version.stdout_lossy().trim().to_owned()),
        files,
        total,
    })
}

/// The locks on the LFS server of `dir`'s remote, with what git-lfs said on the side: with
/// `--json` it answers `[]` and succeeds even when it could not reach a server, saying why only
/// there.
pub async fn lfs_locks(
    git: &Git,
    dir: &Path,
    cancel: &CancellationToken,
) -> Result<(Vec<LfsLock>, Option<String>), LfsError> {
    let output = lfs(git, dir)
        .args(["locks", "--json"])
        .output(cancel)
        .await?;
    if !output.success() {
        return Err(LfsError::Rejected {
            output: output.combined(),
        });
    }
    let locks = serde_json::from_str(output.stdout_lossy().trim())
        .map_err(|error| LfsError::Parse(error.to_string()))?;
    let said = output.stderr_lossy().trim().to_owned();
    Ok((locks, (!said.is_empty()).then_some(said)))
}

/// Locks `path` (relative, `/` separated) on the LFS server; returns what git-lfs said.
pub async fn lfs_lock(
    git: &Git,
    dir: &Path,
    path: &str,
    cancel: &CancellationToken,
) -> Result<String, LfsError> {
    run(lfs(git, dir).arg("lock").paths([path]), cancel).await
}

/// Unlocks lock `id` (`force`: someone else's); returns what git-lfs said.
pub async fn lfs_unlock(
    git: &Git,
    dir: &Path,
    id: &str,
    force: bool,
    cancel: &CancellationToken,
) -> Result<String, LfsError> {
    let mut command = lfs(git, dir).arg("unlock").option("--id", id);
    if force {
        command = command.arg("--force");
    }
    run(command, cancel).await
}

/// `git lfs pull`: downloads and checks out the contents of the LFS files that are pointers.
pub fn lfs_pull_command(git: &Git, dir: &Path) -> GitCommand {
    lfs(git, dir).arg("pull")
}

/// Whether a repository uses Git LFS, cheaply and without git-lfs: git-lfs has stored objects
/// (`<common dir>/lfs`), or the top `.gitattributes` sends files through `filter=lfs`.
pub fn uses_lfs(common_dir: &Path, work_dir: Option<&Path>) -> bool {
    common_dir.join("lfs").is_dir()
        || work_dir
            .and_then(|dir| std::fs::read_to_string(dir.join(".gitattributes")).ok())
            .is_some_and(|attributes| attributes.contains("filter=lfs"))
}

#[cfg(test)]
mod tests {
    use super::{LfsLock, LfsOwner, parse_lfs_files};

    #[test]
    fn reads_files_with_content_or_pointers() {
        let output = "2ec2 * a.bin (3.0 KB)\nc9fb - sub dir/c (d).bin (100 B)\n";
        let files = parse_lfs_files(output);
        assert_eq!(files.len(), 2);
        assert_eq!(
            (files[0].path.as_str(), files[0].size.as_str()),
            ("a.bin", "3.0 KB")
        );
        assert!(files[0].has_content);
        assert_eq!(files[1].path, "sub dir/c (d).bin");
        assert!(!files[1].has_content);
    }

    #[test]
    fn reads_locks() {
        let json = r#"[{"id":"7","path":"a.bin","owner":{"name":"Ada"},"locked_at":"2026-11-11T03:00:00Z"}]"#;
        let locks: Vec<LfsLock> = serde_json::from_str(json).unwrap();
        assert_eq!(locks[0].owner, Some(LfsOwner { name: "Ada".into() }));
        assert_eq!(locks[0].path, "a.bin");
    }
}
