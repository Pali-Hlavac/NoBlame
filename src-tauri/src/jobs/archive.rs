//! Saving an archive of a revision (zip or tar.gz) as a job: on a large tree `git archive` takes
//! a while, and it can be cancelled. git writes next to the chosen file under a temporary name,
//! renamed once it succeeded: a failed or cancelled archive never leaves half a file, nor
//! removes the file it was to replace.

use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use git_core::patch::{ArchiveFormat, archive_command, archive_prefix};
use serde::Deserialize;
use specta::Type;
use tauri::WebviewWindow;

use super::registry::{JobRegistry, JobSpec};
use super::target::JobTarget;
use super::types::{JobId, JobKindDto, JobStateDto};
use crate::patches::ask::{self, FileKind};
use crate::patches::patch_hint;
use crate::repository::RepositoryError;

/// The archive's format.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum ArchiveFormatDto {
    Zip,
    TarGz,
}

/// An archive to save; the app asks where.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ArchiveRequestDto {
    /// The repository's folder.
    pub path: String,
    /// The commit, branch or tag whose files are archived.
    pub revision: String,
    /// How the job's title names it (`v1.0`, `a1b2c3d4`).
    pub label: String,
    pub format: ArchiveFormatDto,
    /// The folder the files go in inside the archive; empty: none.
    pub folder: String,
    /// The file name proposed.
    pub file_name: String,
}

/// The name git writes under until it succeeded: `app.zip.partial`.
fn partial_path(file: &Path) -> PathBuf {
    let mut name = file.file_name().unwrap_or_default().to_owned();
    name.push(".partial");
    file.with_file_name(name)
}

/// Asks where, then starts `git archive`; `None` when the user cancelled.
pub async fn start(
    window: &WebviewWindow,
    registry: &Arc<JobRegistry>,
    request: ArchiveRequestDto,
) -> Result<Option<JobId>, RepositoryError> {
    let prefix = archive_prefix(&request.folder)?;
    let target = JobTarget::open(&request.path).await?;
    let (format, kind) = match request.format {
        ArchiveFormatDto::Zip => (
            ArchiveFormat::Zip,
            FileKind {
                name: "Zip archive",
                extensions: &["zip"],
            },
        ),
        ArchiveFormatDto::TarGz => (
            ArchiveFormat::TarGz,
            FileKind {
                name: "Tar archive, gzip-compressed",
                extensions: &["gz", "tgz"],
            },
        ),
    };
    let title = "Save the archive as";
    let Some(file) = ask::save_path(window, title, &request.file_name, &kind).await? else {
        return Ok(None);
    };
    let partial = partial_path(&file);
    let command = archive_command(
        &target.git,
        &target.dir,
        &request.revision,
        format,
        prefix.as_deref(),
        &partial,
    )?;
    let shown = file.display().to_string();
    Ok(Some(registry.start(JobSpec {
        kind: JobKindDto::Archive,
        title: format!("Archive {}", request.label),
        repo_path: request.path,
        steps: vec![command],
        describe: Box::new(move |_| format!("Saved {shown}")),
        hint: Some(patch_hint),
        on_end: Some(Box::new(move |state| finished(state, &partial, &file))),
    })))
}

/// Renames the archive once written, or removes what a failed or cancelled one left.
fn finished(state: JobStateDto, partial: &Path, file: &Path) -> Option<String> {
    if state == JobStateDto::Succeeded {
        return fs::rename(partial, file).err().map(|error| {
            tracing::warn!(%error, "renaming a saved archive failed");
            format!(
                "The archive was saved as {}, but could not be renamed to {}: {error}",
                partial.display(),
                file.display()
            )
        });
    }
    match fs::remove_file(partial) {
        Err(error) if error.kind() != io::ErrorKind::NotFound => {
            tracing::warn!(%error, "removing a partial archive failed");
            Some(format!(
                "What it had written ({}) could not be removed: {error}",
                partial.display()
            ))
        }
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use std::path::Path;

    use super::{JobStateDto, finished, partial_path};

    #[test]
    fn the_archive_is_renamed_once_written_and_removed_otherwise() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("app.zip");
        let partial = partial_path(&file);
        assert_eq!(
            partial.file_name(),
            Some(Path::new("app.zip.partial").as_os_str())
        );
        std::fs::write(&file, "old").unwrap();
        std::fs::write(&partial, "half").unwrap();
        assert_eq!(finished(JobStateDto::Cancelled, &partial, &file), None);
        assert!(!partial.exists());
        assert_eq!(std::fs::read_to_string(&file).unwrap(), "old");
        std::fs::write(&partial, "new").unwrap();
        assert_eq!(finished(JobStateDto::Succeeded, &partial, &file), None);
        assert_eq!(std::fs::read_to_string(&file).unwrap(), "new");
    }
}
