//! Finding commits in the graph a tab shows, and "go to commit".

use git_core::graph::{Located, resolve_commit};

use super::{FoundCommit, GoToCommit, GoToStatus, RepoId, RepoSessions, RepositoryError, blocking};

/// The match of `query` after `from` (before it when `backwards`), wrapping around; the first
/// (or last) match without `from`.
pub async fn find_commit(
    sessions: &RepoSessions,
    id: RepoId,
    query: String,
    from: Option<u32>,
    backwards: bool,
) -> Result<FoundCommit, RepositoryError> {
    let rows = sessions.get(id)?.find_rows(query).await?;
    let total = u32::try_from(rows.len()).unwrap_or(u32::MAX);
    Ok(match pick_match(&rows, from, backwards) {
        Some(index) => FoundCommit {
            row: rows.get(index).copied(),
            position: u32::try_from(index + 1).unwrap_or(u32::MAX),
            total,
        },
        None => FoundCommit {
            row: None,
            position: 0,
            total,
        },
    })
}

/// Index into `rows` (ascending) of the next match after `from`, or the previous one before it
/// when `backwards`; wraps around at the ends.
fn pick_match(rows: &[u32], from: Option<u32>, backwards: bool) -> Option<usize> {
    if rows.is_empty() {
        return None;
    }
    let last = rows.len() - 1;
    Some(match (from, backwards) {
        (None, false) => 0,
        (None, true) => last,
        (Some(from), false) => rows.partition_point(|&row| row <= from) % rows.len(),
        (Some(from), true) => rows
            .partition_point(|&row| row < from)
            .checked_sub(1)
            .unwrap_or(last),
    })
}

/// The commit `revision` names (an id, a branch or tag, `HEAD~2`, ...) and its row.
pub async fn go_to_commit(
    sessions: &RepoSessions,
    id: RepoId,
    revision: String,
) -> Result<GoToCommit, RepositoryError> {
    let session = sessions.get(id)?;
    let graph = session.graph(false).await?;
    let repo = session.repo.clone();
    let commit = blocking(move || resolve_commit(&repo.local(), &revision)).await??;
    let (row, status) = match graph.locate(&commit) {
        Located::Shown(row) => (Some(row), GoToStatus::Shown),
        Located::Hidden => (None, GoToStatus::HiddenByFilter),
        Located::NotInGraph => (None, GoToStatus::NotInGraph),
    };
    Ok(GoToCommit {
        id: commit.to_string(),
        row,
        status,
    })
}

#[cfg(test)]
mod tests {
    use super::pick_match;

    #[test]
    fn matches_wrap_around_in_both_directions() {
        let rows = [3, 10, 42];
        assert_eq!(pick_match(&rows, None, false), Some(0));
        assert_eq!(pick_match(&rows, None, true), Some(2));
        assert_eq!(pick_match(&rows, Some(3), false), Some(1));
        assert_eq!(pick_match(&rows, Some(5), false), Some(1));
        assert_eq!(pick_match(&rows, Some(42), false), Some(0));
        assert_eq!(pick_match(&rows, Some(10), true), Some(0));
        assert_eq!(pick_match(&rows, Some(3), true), Some(2));
        assert_eq!(pick_match(&[], Some(3), true), None);
    }
}
