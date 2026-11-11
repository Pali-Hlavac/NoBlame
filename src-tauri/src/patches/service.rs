//! Patches behind the Tauri commands. Saving asks where with the system's dialog (`ask.rs`);
//! applying holds the session's write lock, and the watcher reports what changed. Patch files
//! chosen in the app are applied in the order of their names (`0001-…`, `0002-…`).

use std::path::{Path, PathBuf};

use git_core::cli::Git;
use git_core::patch::{
    AmOutcome, ApplyOutcome, MAX_PATCH_COMMITS, PatchCommits, PatchError, apply_mailbox,
    apply_patches, check_patches, count_patches, read_patch_file, write_patch_file,
    write_patch_folder,
};
use git_core::repo::{RepoKind, Repository};
use tauri::WebviewWindow;
use tokio_util::sync::CancellationToken;

use super::ask::{self, FileKind};
use super::types::{
    ApplyModeDto, PatchCheckDto, PatchCommitsDto, PatchCountDto, PatchFileDto, PatchOutcomeDto,
    PatchOutputDto, SavePatchesRequestDto, SavedPatchesDto,
};
use crate::git_env::GitEnvError;
use crate::repository::{RepoId, RepoSessions, RepositoryError, blocking};

/// Most patch files applied at once.
const MAX_PATCH_FILES: usize = 1_000;

/// Patch files in the save dialog.
const PATCH_FILES: FileKind = FileKind {
    name: "Patch",
    extensions: &["patch", "mbox", "diff"],
};

/// Where git runs: the work tree, or the repository itself when it is bare.
fn run_dir(repo: &Repository) -> PathBuf {
    let info = repo.info();
    match (&info.work_dir, info.kind) {
        (Some(work_dir), kind) if kind != RepoKind::Bare => work_dir.clone(),
        _ => info.git_dir.clone(),
    }
}

fn work_tree(repo: &Repository) -> Result<PathBuf, RepositoryError> {
    let info = repo.info();
    info.work_dir
        .clone()
        .filter(|_| info.kind != RepoKind::Bare)
        .ok_or(RepositoryError::Bare)
}

fn git() -> Result<Git, RepositoryError> {
    Ok(Git::locate().map_err(GitEnvError::from)?)
}

/// How many commits get a patch (merges are left out and counted apart).
pub async fn count(
    sessions: &RepoSessions,
    id: RepoId,
    commits: PatchCommitsDto,
) -> Result<PatchCountDto, RepositoryError> {
    let dir = run_dir(&sessions.get(id)?.repo);
    let count = count_patches(&git()?, &dir, &commits.into(), &CancellationToken::new()).await?;
    Ok(count.into())
}

/// Asks where, then writes the patches; `None` when the user cancelled.
pub async fn save(
    window: &WebviewWindow,
    sessions: &RepoSessions,
    id: RepoId,
    request: SavePatchesRequestDto,
) -> Result<Option<SavedPatchesDto>, RepositoryError> {
    let dir = run_dir(&sessions.get(id)?.repo);
    let (git, cancel) = (git()?, CancellationToken::new());
    let commits = PatchCommits::from(request.commits);
    let count = count_patches(&git, &dir, &commits, &cancel).await?;
    if count.commits == 0 {
        let what = if count.merges > 0 {
            "There are only merge commits there, and a patch cannot hold a merge."
        } else {
            "There are no commits there to make patches of."
        };
        return Err(PatchError::Invalid(what.to_owned()).into());
    }
    if count.commits > MAX_PATCH_COMMITS {
        return Err(PatchError::Invalid(format!(
            "That is {} commits; at most {MAX_PATCH_COMMITS} can be saved as patches at once.",
            count.commits
        ))
        .into());
    }
    let saved = |path: &Path, files: usize| SavedPatchesDto {
        path: path.display().to_string(),
        commits: count.commits,
        files: u32::try_from(files).unwrap_or(u32::MAX),
    };
    match request.output {
        PatchOutputDto::File => {
            let title = "Save the patches as";
            let Some(file) =
                ask::save_path(window, title, &request.file_name, &PATCH_FILES).await?
            else {
                return Ok(None);
            };
            write_patch_file(&git, &dir, &commits, &file, &cancel).await?;
            Ok(Some(saved(&file, 1)))
        }
        PatchOutputDto::Folder => {
            let Some(folder) = ask::folder(window, "Save the patches in this folder").await? else {
                return Ok(None);
            };
            let written = write_patch_folder(&git, &dir, &commits, &folder, &cancel).await?;
            Ok(Some(saved(&folder, written.len())))
        }
    }
}

/// The chosen files, checked (full paths of files) and sorted by name.
fn chosen(paths: Vec<String>) -> Result<Vec<PathBuf>, RepositoryError> {
    if paths.is_empty() || paths.len() > MAX_PATCH_FILES {
        return Err(PatchError::Invalid(format!(
            "Choose between 1 and {MAX_PATCH_FILES} patch files."
        ))
        .into());
    }
    let mut files: Vec<PathBuf> = paths.into_iter().map(PathBuf::from).collect();
    if let Some(bad) = files
        .iter()
        .find(|file| !file.is_absolute() || !file.is_file())
    {
        return Err(PatchError::Invalid(format!("{} is not a file.", bad.display())).into());
    }
    files.sort_by(|a, b| a.file_name().cmp(&b.file_name()).then_with(|| a.cmp(b)));
    files.dedup();
    Ok(files)
}

/// What the chosen files hold, whether they apply (as `mode` would apply them) and the files
/// they change.
pub async fn check(
    sessions: &RepoSessions,
    id: RepoId,
    paths: Vec<String>,
    mode: ApplyModeDto,
) -> Result<PatchCheckDto, RepositoryError> {
    let dir = work_tree(&sessions.get(id)?.repo)?;
    let files = chosen(paths)?;
    let read = files.clone();
    let described = blocking(move || {
        read.iter()
            .map(|path| {
                Ok(PatchFileDto {
                    path: path.display().to_string(),
                    name: path.file_name().map_or_else(
                        || path.display().to_string(),
                        |name| name.to_string_lossy().into_owned(),
                    ),
                    contents: read_patch_file(path)?.into(),
                })
            })
            .collect::<Result<Vec<_>, PatchError>>()
    })
    .await??;
    let index = mode == ApplyModeDto::Commits;
    let check = check_patches(&git()?, &dir, &files, index, &CancellationToken::new()).await?;
    Ok(PatchCheckDto::new(described, check))
}

/// Applies the chosen files: commits from their mails (`git am`), or only the files.
pub async fn apply(
    sessions: &RepoSessions,
    id: RepoId,
    paths: Vec<String>,
    mode: ApplyModeDto,
) -> Result<PatchOutcomeDto, RepositoryError> {
    let session = sessions.get(id)?;
    let dir = work_tree(&session.repo)?;
    let files = chosen(paths)?;
    let (git, cancel) = (git()?, CancellationToken::new());
    let _writing = session.lock_writes().await;
    Ok(match mode {
        ApplyModeDto::Commits => match apply_mailbox(&git, &dir, &files, &cancel).await?.0 {
            AmOutcome::Committed => PatchOutcomeDto::Committed,
            AmOutcome::Stopped => PatchOutcomeDto::Stopped,
        },
        ApplyModeDto::Files => match apply_patches(&git, &dir, &files, &cancel).await?.0 {
            ApplyOutcome::Applied => PatchOutcomeDto::Applied,
            ApplyOutcome::Merged => PatchOutcomeDto::Merged,
            ApplyOutcome::Conflicts => PatchOutcomeDto::Conflicts,
        },
    })
}

#[cfg(test)]
mod tests {
    use super::chosen;

    #[test]
    fn chosen_files_must_exist_and_are_sorted_by_name() {
        let dir = tempfile::tempdir().unwrap();
        let second = dir.path().join("0002-b.patch");
        let first = dir.path().join("sub").join("0001-a.patch");
        std::fs::create_dir(dir.path().join("sub")).unwrap();
        std::fs::write(&second, "").unwrap();
        std::fs::write(&first, "").unwrap();
        let shown = |path: &std::path::Path| path.display().to_string();
        let files = chosen(vec![shown(&second), shown(&first)]).unwrap();
        assert_eq!(files, [first, second]);
        assert!(chosen(vec![]).is_err());
        assert!(chosen(vec!["relative.patch".into()]).is_err());
        assert!(chosen(vec![shown(dir.path())]).is_err());
    }
}
