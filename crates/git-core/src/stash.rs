//! The stash list (`git stash list`), read from the reflog of `refs/stash` with gix. Creating,
//! applying and dropping stashes run the `git` CLI (M4).

use gix::bstr::ByteSlice;

/// Name of the reference whose reflog holds the stashes.
const STASH_REF: &str = "refs/stash";

/// Failures while reading stashes.
#[derive(Debug, thiserror::Error)]
pub enum StashError {
    /// gix could not read the reference or its reflog.
    #[error("{0}")]
    Gix(String),
}

impl StashError {
    fn gix(error: impl std::fmt::Display) -> Self {
        Self::Gix(error.to_string())
    }
}

/// One stash entry.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StashEntry {
    /// Position: 0 is `stash@{0}`, the newest.
    pub index: u32,
    /// Full hex id of the stash commit.
    pub id: String,
    /// The message as `git stash list` shows it after `stash@{n}: `.
    pub message: String,
    /// Branch the stash was made on, when the message names one.
    pub branch: Option<String>,
    /// When it was made, seconds since the epoch.
    pub time: i64,
}

/// All stashes, newest first. A repository without stashes gives an empty list.
pub fn list_stashes(repo: &gix::Repository) -> Result<Vec<StashEntry>, StashError> {
    let Some(reference) = repo
        .try_find_reference(STASH_REF)
        .map_err(StashError::gix)?
    else {
        return Ok(Vec::new());
    };
    let mut log = reference.log_iter();
    let Some(lines) = log.rev().map_err(StashError::gix)? else {
        return Ok(Vec::new());
    };
    let mut stashes = Vec::new();
    for (index, line) in lines.enumerate() {
        let line = line.map_err(StashError::gix)?;
        let message = line.message.to_str_lossy().into_owned();
        stashes.push(StashEntry {
            index: u32::try_from(index).unwrap_or(u32::MAX),
            id: line.new_oid.to_string(),
            branch: branch_of(&message),
            message,
            time: line.signature.time.seconds,
        });
    }
    Ok(stashes)
}

/// The branch in `WIP on main: …` or `On main: …`; `None` for `(no branch)` and other forms.
fn branch_of(message: &str) -> Option<String> {
    let rest = message
        .strip_prefix("WIP on ")
        .or_else(|| message.strip_prefix("On "))?;
    let (branch, _) = rest.split_once(": ")?;
    (branch != "(no branch)").then(|| branch.to_owned())
}

#[cfg(test)]
mod tests {
    use super::branch_of;

    #[test]
    fn branch_comes_from_both_message_forms() {
        assert_eq!(
            branch_of("WIP on main: 1234567 Fix").as_deref(),
            Some("main")
        );
        assert_eq!(
            branch_of("On topic/x: my message").as_deref(),
            Some("topic/x")
        );
        assert_eq!(branch_of("WIP on (no branch): 1234567 Fix"), None);
        assert_eq!(branch_of("custom"), None);
    }
}
