//! Inspect operations behind the Tauri commands. They reuse the session's graph, so they cost
//! nothing extra when the repository tab has already loaded its history.

use git_core::diff::{
    DiffError, FileDiff, ObjectId, blob_contents, commit_changes, parse_object_id,
};
use git_core::graph::{GraphError, RefKind, commit_details};
use std::path::PathBuf;
use std::sync::Arc;

use git_core::cli::Git;
use git_core::repo::RepoKind;
use git_core::repo::Repository;
use git_core::stash::list_stashes;
use git_core::status::status_summary;
use git_core::submodule::list_submodules;
use tokio_util::sync::CancellationToken;

use super::{
    ChangedFilesDto, CommitDetailsDto, DiffLineDto, DiffRequestDto, FileDiffDto, LineSideDto,
    RefEntry, SplitLineDto, StashDto, StatusSummaryDto, SubmoduleDto,
};
use crate::git_env::GitEnvError;
use crate::repository::{DiffKey, RawBytes, RepoId, RepoSessions, RepositoryError, blocking};
use crate::settings::DiffLayout;

/// Details of the commit on `row`, including the references containing it.
pub async fn details(
    sessions: &RepoSessions,
    id: RepoId,
    row: u32,
) -> Result<CommitDetailsDto, RepositoryError> {
    let session = sessions.get(id)?;
    let graph = session.graph(false).await?;
    let repo = session.repo.clone();
    let details = blocking(move || commit_details(&repo.local(), &graph, row)).await??;
    Ok(details.into())
}

/// The files the commit on `row` changed against its parent number `parent` (0 = first).
pub async fn changed_files(
    sessions: &RepoSessions,
    id: RepoId,
    row: u32,
    parent: u32,
) -> Result<ChangedFilesDto, RepositoryError> {
    let session = sessions.get(id)?;
    let graph = session.graph(false).await?;
    let commit = graph.id_at(row).ok_or(GraphError::RowOutOfRange {
        row,
        rows: graph.row_count(),
    })?;
    let repo = session.repo.clone();
    let changes =
        blocking(move || commit_changes(&repo.local(), commit, parent as usize)).await??;
    Ok(changes.into())
}

/// Most diff rows one request may ask for.
const MAX_DIFF_PAGE_ROWS: u32 = 2_000;

async fn computed(
    sessions: &RepoSessions,
    id: RepoId,
    request: DiffRequestDto,
) -> Result<Arc<FileDiff>, RepositoryError> {
    let session = sessions.get(id)?;
    let (old, new) = (parse(request.old_id)?, parse(request.new_id)?);
    let key = DiffKey {
        old,
        new,
        path: request.path,
        syntax: request.options.syntax,
        options: request.options.into(),
    };
    session.file_diff(key).await
}

/// The diff a request names: kind, counts and row counts.
pub async fn file_diff(
    sessions: &RepoSessions,
    id: RepoId,
    request: DiffRequestDto,
) -> Result<FileDiffDto, RepositoryError> {
    Ok(FileDiffDto::from(&*computed(sessions, id, request).await?))
}

/// Up to `count` unified rows of that diff from row `start`.
pub async fn diff_lines(
    sessions: &RepoSessions,
    id: RepoId,
    request: DiffRequestDto,
    start: u32,
    count: u32,
) -> Result<Vec<DiffLineDto>, RepositoryError> {
    let diff = computed(sessions, id, request).await?;
    let lines = diff.lines(start, count.min(MAX_DIFF_PAGE_ROWS));
    Ok(lines.into_iter().map(DiffLineDto::from).collect())
}

/// Up to `count` side-by-side rows of that diff from row `start`.
pub async fn split_diff_lines(
    sessions: &RepoSessions,
    id: RepoId,
    request: DiffRequestDto,
    start: u32,
    count: u32,
) -> Result<Vec<SplitLineDto>, RepositoryError> {
    let diff = computed(sessions, id, request).await?;
    let lines = diff.split_lines(start, count.min(MAX_DIFF_PAGE_ROWS));
    Ok(lines.into_iter().map(SplitLineDto::from).collect())
}

/// The row (of `layout`) showing line `line` of `side`, or the row of the nearest line shown;
/// `None` when the diff has no rows.
pub async fn diff_row_of_line(
    sessions: &RepoSessions,
    id: RepoId,
    request: DiffRequestDto,
    layout: DiffLayout,
    side: LineSideDto,
    line: u32,
) -> Result<Option<u32>, RepositoryError> {
    let diff = computed(sessions, id, request).await?;
    Ok(match layout {
        DiffLayout::Unified => diff.row_of_line(side.into(), line),
        DiffLayout::Split => diff.split_row_of_line(side.into(), line),
    })
}

/// Largest file sent for a preview (images).
const MAX_PREVIEW_BYTES: u64 = 32 << 20;

/// The contents of blob `blob` (hex id), for previews; refused above 32 MB.
pub async fn file_contents(
    sessions: &RepoSessions,
    id: RepoId,
    blob: String,
) -> Result<RawBytes, RepositoryError> {
    let repo = sessions.get(id)?.repo.clone();
    let blob = parse_object_id(&blob)?;
    let bytes = blocking(move || blob_contents(&repo.local(), blob, MAX_PREVIEW_BYTES)).await??;
    Ok(RawBytes(bytes))
}

fn parse(id: Option<String>) -> Result<Option<ObjectId>, DiffError> {
    id.as_deref().map(parse_object_id).transpose()
}

/// Local branches, remote branches and tags (not a detached HEAD), sorted by kind and name,
/// with the time of their commit (from the whole history, also when a filter hides it).
pub async fn refs(sessions: &RepoSessions, id: RepoId) -> Result<Vec<RefEntry>, RepositoryError> {
    let graph = sessions.get(id)?.graph(false).await?;
    blocking(move || {
        let index = graph.full().index();
        graph
            .refs_with_rows()
            .into_iter()
            .filter(|(reference, _)| reference.kind != RefKind::DetachedHead)
            .map(|(reference, row)| {
                let time = index
                    .lookup(&reference.target)
                    .map(|commit| index.time(commit));
                RefEntry::new(reference, row, time)
            })
            .collect()
    })
    .await
}

/// The stash list, newest first. Read from disk every time (stashes change outside the app).
pub async fn stashes(
    sessions: &RepoSessions,
    id: RepoId,
) -> Result<Vec<StashDto>, RepositoryError> {
    let repo = sessions.get(id)?.repo.clone();
    let stashes = blocking(move || list_stashes(&repo.local())).await??;
    Ok(stashes.into_iter().map(StashDto::from).collect())
}

/// How many files are staged, changed, untracked and conflicted; `None` for a bare
/// repository (no working tree). Runs `git status` every time: the working tree changes
/// outside the app.
pub async fn status(
    sessions: &RepoSessions,
    id: RepoId,
) -> Result<Option<StatusSummaryDto>, RepositoryError> {
    let session = sessions.get(id)?;
    let info = session.repo.info();
    let Some(work_dir) = info
        .work_dir
        .clone()
        .filter(|_| info.kind != RepoKind::Bare)
    else {
        return Ok(None);
    };
    let git = Git::locate().map_err(GitEnvError::from)?;
    let summary = status_summary(&git, &work_dir, &CancellationToken::new()).await?;
    Ok(Some(summary.into()))
}

/// The submodule tree of the repository at `path` (no session needed: the Repositories module
/// lists submodules of every open repository).
pub async fn submodules(path: String) -> Result<Vec<SubmoduleDto>, RepositoryError> {
    let entries = blocking(move || {
        let repo = Repository::discover(&PathBuf::from(path))?;
        Ok::<_, RepositoryError>(list_submodules(&repo.local())?)
    })
    .await??;
    Ok(entries.into_iter().map(SubmoduleDto::from).collect())
}
