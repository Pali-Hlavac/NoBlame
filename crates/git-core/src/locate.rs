//! Finding a working tree file on disk, to open it in its default app or show it in the file
//! manager, and refusing to open files that would run as programs: a repository is data, and
//! "Open" on `setup.bat` or `build.js` (Windows runs both) must not execute anything.

use std::path::{Component, Path, PathBuf};

/// Why a working tree file cannot be opened or shown.
#[derive(Debug, thiserror::Error)]
pub enum LocateError {
    /// The path is absolute, empty, or climbs out with `..`.
    #[error("{0} is not a path inside the working tree")]
    Outside(String),
    /// Nothing is there (deleted, or only in a commit).
    #[error("{0} is not in the working tree")]
    Missing(String),
    /// Its default app would run it as a program.
    #[error("{0} would run as a program")]
    Program(String),
}

/// File name extensions whose default action runs the file (Windows Script Host runs `.js`).
#[cfg(windows)]
const PROGRAM_EXTENSIONS: &[&str] = &[
    "appref-ms",
    "application",
    "bat",
    "cmd",
    "com",
    "cpl",
    "exe",
    "gadget",
    "hta",
    "inf",
    "jar",
    "js",
    "jse",
    "lnk",
    "msc",
    "msi",
    "msp",
    "pif",
    "ps1",
    "psm1",
    "reg",
    "scf",
    "scr",
    "sct",
    "url",
    "vb",
    "vbe",
    "vbs",
    "ws",
    "wsc",
    "wsf",
    "wsh",
];

/// File name extensions whose default action runs the file (Terminal runs `.command`).
#[cfg(not(windows))]
const PROGRAM_EXTENSIONS: &[&str] = &[
    "app", "appimage", "command", "desktop", "jar", "mpkg", "pkg", "run", "terminal", "tool",
    "workflow",
];

/// Where the working tree item at `path` (`/`-separated, relative to `work_dir`) is on disk,
/// whether or not it exists. Paths that would leave the working tree are refused.
pub fn worktree_item(work_dir: &Path, path: &str) -> Result<PathBuf, LocateError> {
    let relative = Path::new(path);
    let normal = relative
        .components()
        .all(|component| matches!(component, Component::Normal(_)));
    if !normal || path.is_empty() {
        return Err(LocateError::Outside(path.to_owned()));
    }
    Ok(work_dir.join(relative))
}

/// `full` when it exists, else its nearest folder that does, up to `work_dir` (a deleted
/// file's folder, to show in the file manager).
pub fn nearest_existing(work_dir: &Path, full: &Path) -> PathBuf {
    full.ancestors()
        .take_while(|ancestor| ancestor.starts_with(work_dir))
        .find(|ancestor| ancestor.exists())
        .unwrap_or(work_dir)
        .to_path_buf()
}

/// Checks that the existing file `full` (shown as `path`) can be opened in its default app:
/// it exists and opening it would not run it (by its extension, or its executable bit).
pub fn openable(full: &Path, path: &str) -> Result<(), LocateError> {
    let metadata = std::fs::metadata(full).map_err(|_| LocateError::Missing(path.to_owned()))?;
    if metadata.is_dir() {
        return Ok(());
    }
    let extension = full
        .extension()
        .map(|extension| extension.to_string_lossy().to_ascii_lowercase());
    let by_name = extension.is_some_and(|extension| PROGRAM_EXTENSIONS.contains(&&*extension));
    if by_name || executable(&metadata) {
        return Err(LocateError::Program(path.to_owned()));
    }
    Ok(())
}

#[cfg(unix)]
fn executable(metadata: &std::fs::Metadata) -> bool {
    use std::os::unix::fs::PermissionsExt;
    const ANY_EXECUTE: u32 = 0o111;
    metadata.permissions().mode() & ANY_EXECUTE != 0
}

#[cfg(not(unix))]
fn executable(_metadata: &std::fs::Metadata) -> bool {
    false
}

#[cfg(test)]
mod tests {
    use std::path::Path;

    use super::{LocateError, nearest_existing, openable, worktree_item};

    #[test]
    fn refuses_paths_that_leave_the_working_tree() {
        let root = Path::new("/repo");
        assert!(worktree_item(root, "src/main.rs").is_ok());
        for path in ["", "../x", "src/../../x", "/etc/passwd", "./x"] {
            assert!(
                matches!(worktree_item(root, path), Err(LocateError::Outside(_))),
                "{path}"
            );
        }
    }

    #[test]
    fn opens_documents_but_not_programs() {
        let dir = std::env::temp_dir().join(format!("noblame-locate-{}", std::process::id()));
        std::fs::create_dir_all(dir.join("docs")).unwrap();
        std::fs::write(dir.join("docs/readme.md"), "hi").unwrap();
        std::fs::write(dir.join("docs/tool.JAR"), "").unwrap();
        assert!(openable(&dir.join("docs/readme.md"), "docs/readme.md").is_ok());
        assert!(openable(&dir.join("docs"), "docs").is_ok());
        assert!(matches!(
            openable(&dir.join("docs/tool.JAR"), "docs/tool.JAR"),
            Err(LocateError::Program(_))
        ));
        assert!(matches!(
            openable(&dir.join("gone.txt"), "gone.txt"),
            Err(LocateError::Missing(_))
        ));
        // A deleted file is shown by its folder.
        assert_eq!(
            nearest_existing(&dir, &dir.join("docs/gone/x.txt")),
            dir.join("docs")
        );
        std::fs::remove_dir_all(&dir).unwrap();
    }
}
