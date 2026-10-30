//! The file diffs shown last in a session, so paging through a diff does not compute it again
//! and switching back to a file is instant. Blobs are content-addressed: entries never go stale.

use std::collections::VecDeque;
use std::sync::{Arc, Mutex, MutexGuard, PoisonError};

use git_core::diff::{DiffOptions, FileDiff, ObjectId};

/// Diffs kept per session.
const MAX_ENTRIES: usize = 8;
/// Older diffs are dropped while the cache holds more than this; the newest always stays.
const MAX_BYTES: usize = 256 << 20;

/// Which diff: the two versions it compares (`None`: the file is absent on that side), the
/// file's path (its `.gitattributes` and language apply), the options and whether it is
/// syntax-highlighted. With `whole`, it is the new version shown whole (a file view) instead.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DiffKey {
    pub old: Option<ObjectId>,
    pub new: Option<ObjectId>,
    pub path: Option<String>,
    pub options: DiffOptions,
    pub syntax: bool,
    pub whole: bool,
}

/// Most recently used first.
#[derive(Default)]
pub struct DiffCache {
    entries: Mutex<VecDeque<(DiffKey, Arc<FileDiff>)>>,
}

impl DiffCache {
    /// The diff for `key`, if it is cached; it becomes the most recently used.
    pub fn get(&self, key: &DiffKey) -> Option<Arc<FileDiff>> {
        let mut entries = self.lock();
        let index = entries.iter().position(|(cached, _)| cached == key)?;
        let entry = entries.remove(index)?;
        let diff = Arc::clone(&entry.1);
        entries.push_front(entry);
        Some(diff)
    }

    /// Adds a diff and drops the oldest ones beyond the budget.
    pub fn insert(&self, key: DiffKey, diff: Arc<FileDiff>) {
        let mut entries = self.lock();
        entries.retain(|(cached, _)| *cached != key);
        entries.push_front((key, diff));
        let mut total = 0;
        let mut keep = 0;
        for (_, diff) in entries.iter().take(MAX_ENTRIES) {
            total += diff.memory_bytes();
            if keep > 0 && total > MAX_BYTES {
                break;
            }
            keep += 1;
        }
        entries.truncate(keep);
    }

    fn lock(&self) -> MutexGuard<'_, VecDeque<(DiffKey, Arc<FileDiff>)>> {
        // Every update leaves the queue consistent, so a poisoned lock is still usable.
        self.entries.lock().unwrap_or_else(PoisonError::into_inner)
    }
}
