//! The reflog: where HEAD (or a local branch) pointed before each change, newest first, read
//! from `.git/logs/` with gix. It is how lost commits are found again after a reset, a rebase or
//! a deleted branch. Read-only; nothing here writes.

use gix::bstr::ByteSlice;
use gix::refs::Category;

/// More entries than this are not read (the oldest are left out).
pub const MAX_REFLOG_ENTRIES: usize = 5000;

/// One change of a reference.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReflogEntry {
    /// Its number in `<ref>@{n}`: 0 is the newest.
    pub index: u32,
    /// Where the reference pointed after the change (full id; all zeros when it was deleted).
    pub new_id: String,
    /// Where it pointed before (all zeros when it was created).
    pub old_id: String,
    /// Who made the change.
    pub committer: String,
    /// When, in seconds since the epoch.
    pub time: i64,
    /// What git wrote: `commit: Fix the parser`, `checkout: moving from main to topic`,
    /// `reset: moving to HEAD~1`, `rebase (finish): returning to refs/heads/topic`, ...
    pub message: String,
}

/// A reference's reflog, newest first.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct Reflog {
    /// The entries; empty when the reference has no reflog (`core.logAllRefUpdates` off).
    pub entries: Vec<ReflogEntry>,
    /// More than [`MAX_REFLOG_ENTRIES`] entries exist; the oldest are left out.
    pub truncated: bool,
}

/// Reading a reflog failed.
#[derive(Debug, thiserror::Error)]
pub enum ReflogError {
    /// The reference does not exist, or is not one whose reflog is shown.
    #[error("there is no reference {0:?}")]
    NotFound(String),
    /// gix could not read the references or the log file.
    #[error("{0}")]
    Read(String),
}

fn read_error(error: impl std::fmt::Display) -> ReflogError {
    ReflogError::Read(error.to_string())
}

/// `HEAD` and the full names of the local branches that have a reflog, the branches sorted.
pub fn reflog_references(repo: &gix::Repository) -> Result<Vec<String>, ReflogError> {
    let mut names = Vec::new();
    let platform = repo.references().map_err(read_error)?;
    for reference in platform.all().map_err(read_error)? {
        let Ok(reference) = reference else { continue };
        if reference.name().category() == Some(Category::LocalBranch)
            && reference.log_exists().unwrap_or(false)
        {
            names.push(reference.name().as_bstr().to_str_lossy().into_owned());
        }
    }
    names.sort();
    names.insert(0, "HEAD".to_owned());
    Ok(names)
}

/// The reflog of `name` (`HEAD`, or a local branch's full name), newest first. Blocking.
pub fn reflog(repo: &gix::Repository, name: &str) -> Result<Reflog, ReflogError> {
    if name != "HEAD" && !name.starts_with("refs/heads/") {
        return Err(ReflogError::NotFound(name.to_owned()));
    }
    let reference = repo
        .find_reference(name)
        .map_err(|_| ReflogError::NotFound(name.to_owned()))?;
    let mut platform = reference.log_iter();
    let Some(lines) = platform.rev().map_err(read_error)? else {
        return Ok(Reflog::default());
    };
    let mut log = Reflog::default();
    for (index, line) in lines.enumerate() {
        if index == MAX_REFLOG_ENTRIES {
            log.truncated = true;
            break;
        }
        let line = line.map_err(read_error)?;
        log.entries.push(ReflogEntry {
            index: u32::try_from(index).unwrap_or(u32::MAX),
            new_id: line.new_oid.to_string(),
            old_id: line.previous_oid.to_string(),
            committer: line.signature.name.to_str_lossy().trim().to_owned(),
            time: line.signature.time.seconds,
            message: line.message.to_str_lossy().trim().to_owned(),
        });
    }
    Ok(log)
}
