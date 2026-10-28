//! The on-disk commit index of each repository (ADR 0010), in the platform cache directory.
//!
//! Reopening a repository then reads only the commits made since: seconds saved on histories
//! without a commit-graph file. The cache is a pure speed-up: a missing, old or damaged file is
//! ignored (and deleted), and the graph is built from the repository as before.

use std::fs;
use std::io::{BufWriter, Write};
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};

use git_core::graph::CommitIndex;
use git_core::repo::Repository;

/// Folder inside the app cache directory.
const CACHE_FOLDER: &str = "graph-cache";
/// File extension of cached indexes.
const EXTENSION: &str = "nbci";
/// Files not written for this long belong to repositories no longer used and are deleted.
pub const MAX_AGE: Duration = Duration::from_secs(30 * 24 * 60 * 60);

/// Where cached indexes live; `None` when the platform has no cache directory.
#[derive(Debug, Default)]
pub struct GraphCache {
    dir: Option<PathBuf>,
}

impl GraphCache {
    /// A cache in `app_cache_dir/graph-cache`.
    pub fn new(app_cache_dir: Option<PathBuf>) -> Self {
        Self {
            dir: app_cache_dir.map(|dir| dir.join(CACHE_FOLDER)),
        }
    }

    /// The cached index of `repo`, if there is a usable one.
    pub fn load(&self, repo: &Repository) -> Option<CommitIndex> {
        let path = self.path_for(repo)?;
        let bytes = fs::read(&path).ok()?;
        match CommitIndex::read_from(&bytes) {
            Ok(index) if index.reusable(&repo.local()) => Some(index),
            Ok(_) => None,
            Err(error) => {
                tracing::info!(%error, path = %path.display(), "ignoring the cached commit index");
                let _ = fs::remove_file(&path);
                None
            }
        }
    }

    /// Saves `index` for `repo` (temp file, then rename, so readers never see half a file).
    /// Failing to save only costs speed next time, so errors are logged.
    pub fn store(&self, repo: &Repository, index: &CommitIndex) {
        let Some(path) = self.path_for(repo) else {
            return;
        };
        if !index.reusable(&repo.local()) {
            return;
        }
        if let Err(error) = write_atomically(&path, index) {
            tracing::warn!(%error, path = %path.display(), "could not save the commit index");
        }
    }

    /// Deletes cached indexes not written for `max_age`.
    pub fn prune(&self, max_age: Duration) {
        let Some(dir) = &self.dir else { return };
        let Ok(entries) = fs::read_dir(dir) else {
            return;
        };
        let now = SystemTime::now();
        for entry in entries.flatten() {
            let path = entry.path();
            let old = entry
                .metadata()
                .and_then(|meta| meta.modified())
                .is_ok_and(|modified| now.duration_since(modified).unwrap_or_default() >= max_age);
            if old
                && path
                    .extension()
                    .is_some_and(|extension| extension == EXTENSION)
            {
                let _ = fs::remove_file(path);
            }
        }
    }

    /// One file per repository, named after a stable hash of its common `.git` folder (linked
    /// work trees share their repository's history).
    fn path_for(&self, repo: &Repository) -> Option<PathBuf> {
        let dir = self.dir.as_ref()?;
        let common = repo.local().common_dir().to_path_buf();
        let common = fs::canonicalize(&common).unwrap_or(common);
        Some(dir.join(format!(
            "{:016x}.{EXTENSION}",
            fnv1a(common.as_os_str().as_encoded_bytes())
        )))
    }
}

fn write_atomically(path: &Path, index: &CommitIndex) -> Result<(), Box<dyn std::error::Error>> {
    let dir = path.parent().ok_or("cache path has no folder")?;
    fs::create_dir_all(dir)?;
    // Unique per process, so two NoBlame instances never write the same temp file.
    let temp = path.with_extension(format!("{EXTENSION}.{}.tmp", std::process::id()));
    let written = (|| -> Result<(), Box<dyn std::error::Error>> {
        let mut out = BufWriter::new(fs::File::create(&temp)?);
        index.write_to(&mut out)?;
        out.flush()?;
        Ok(())
    })();
    match written.and_then(|()| fs::rename(&temp, path).map_err(Into::into)) {
        Ok(()) => Ok(()),
        Err(error) => {
            let _ = fs::remove_file(&temp);
            Err(error)
        }
    }
}

/// FNV-1a, 64 bit: stable across Rust versions and platforms (unlike `DefaultHasher`).
fn fnv1a(bytes: &[u8]) -> u64 {
    const OFFSET: u64 = 0xcbf2_9ce4_8422_2325;
    const PRIME: u64 = 0x0000_0100_0000_01b3;
    bytes.iter().fold(OFFSET, |hash, &byte| {
        (hash ^ u64::from(byte)).wrapping_mul(PRIME)
    })
}

#[cfg(test)]
mod tests {
    #![allow(clippy::unwrap_used)]
    use super::*;

    #[test]
    fn fnv1a_is_stable() {
        // Reference values of the FNV-1a 64-bit test suite.
        assert_eq!(fnv1a(b""), 0xcbf2_9ce4_8422_2325);
        assert_eq!(fnv1a(b"a"), 0xaf63_dc4c_8601_ec8c);
    }

    fn repository_with_a_commit(dir: &Path) -> Repository {
        let git = |args: &[&str]| {
            let status = std::process::Command::new("git")
                .args(["-c", "user.name=Test", "-c", "user.email=test@example.com"])
                .args(args)
                .current_dir(dir)
                .status()
                .unwrap();
            assert!(status.success());
        };
        git(&["init", "--quiet"]);
        git(&["commit", "--quiet", "--allow-empty", "-m", "one"]);
        Repository::discover(dir).unwrap()
    }

    #[test]
    fn stores_loads_and_drops_damaged_files() {
        let repo_dir = tempfile::tempdir().unwrap();
        let cache_dir = tempfile::tempdir().unwrap();
        let repo = repository_with_a_commit(repo_dir.path());
        let cache = GraphCache::new(Some(cache_dir.path().to_path_buf()));
        assert!(cache.load(&repo).is_none());

        let graph = git_core::graph::Graph::build(&repo.local()).unwrap();
        cache.store(&repo, graph.index());
        assert_eq!(cache.load(&repo).map(|index| index.len()), Some(1));

        let path = cache.path_for(&repo).unwrap();
        fs::write(&path, b"damaged").unwrap();
        assert!(cache.load(&repo).is_none());
        assert!(!path.exists(), "a damaged cache file is deleted");
    }

    #[test]
    fn prune_deletes_only_old_index_files() {
        let dir = tempfile::tempdir().unwrap();
        let cache = GraphCache::new(Some(dir.path().to_path_buf()));
        let folder = dir.path().join(CACHE_FOLDER);
        fs::create_dir_all(&folder).unwrap();
        fs::write(folder.join("a.nbci"), b"x").unwrap();
        fs::write(folder.join("keep.txt"), b"x").unwrap();
        cache.prune(Duration::ZERO);
        assert!(!folder.join("a.nbci").exists());
        assert!(folder.join("keep.txt").exists());
    }
}
