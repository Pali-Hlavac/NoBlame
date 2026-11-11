//! Saving the files of a revision as an archive with `git archive` (zip or tar.gz), optionally
//! inside a folder. Built as a command for a background job: on a large tree it takes a while.
//! Submodules' files are not included (git archives only the repository's own tree).

use std::path::Path;

use super::PatchError;
use crate::cli::{Git, GitCommand};

/// The archive's format.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ArchiveFormat {
    /// A zip file.
    Zip,
    /// A gzip-compressed tar file.
    TarGz,
}

impl ArchiveFormat {
    fn name(self) -> &'static str {
        match self {
            Self::Zip => "--format=zip",
            Self::TarGz => "--format=tar.gz",
        }
    }
}

/// `name/` for `git archive --prefix`: a relative folder (`/`-separated, no `.` or `..`, no
/// `\`), or `None` for the files at the archive's top.
pub fn archive_prefix(folder: &str) -> Result<Option<String>, PatchError> {
    let folder = folder.trim().trim_end_matches('/');
    if folder.is_empty() {
        return Ok(None);
    }
    let bad_part = folder
        .split('/')
        .any(|part| part.is_empty() || part == "." || part == "..");
    if bad_part || folder.contains(['\\', ':', '\0']) {
        return Err(PatchError::Invalid(format!(
            "“{folder}” cannot be a folder inside the archive. Use a plain name, like project-1.0."
        )));
    }
    Ok(Some(format!("{folder}/")))
}

/// `git archive` of `revision` from the repository at `dir` into `output`, the files inside
/// `prefix` (from [`archive_prefix`]) when given.
pub fn archive_command(
    git: &Git,
    dir: &Path,
    revision: &str,
    format: ArchiveFormat,
    prefix: Option<&str>,
    output: &Path,
) -> Result<GitCommand, PatchError> {
    let mut command = git
        .command()
        .current_dir(dir)
        .args(["archive", format.name()])
        .option("--output", output);
    if let Some(prefix) = prefix {
        command = command.option("--prefix", prefix);
    }
    Ok(command.revision(revision)?)
}

#[cfg(test)]
mod tests {
    use super::archive_prefix;

    #[test]
    fn folder_names_inside_the_archive() {
        assert_eq!(
            archive_prefix(" app-1.0/ ").unwrap(),
            Some("app-1.0/".into())
        );
        assert_eq!(archive_prefix("a/b").unwrap(), Some("a/b/".into()));
        assert_eq!(archive_prefix("").unwrap(), None);
        for bad in ["../up", "a//b", "/abs", "a\\b", "c:x", "./a"] {
            assert!(archive_prefix(bad).is_err(), "{bad}");
        }
    }
}
