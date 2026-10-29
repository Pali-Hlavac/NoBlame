//! Filtering commits by author and message: the commit objects still shown are read on several
//! threads and searched for the words given, ignoring case.

use std::sync::atomic::{AtomicUsize, Ordering};

use gix::bstr::ByteSlice;
use tokio_util::sync::CancellationToken;

use super::{CommitIndex, GraphError};

/// Commits handed to a thread at a time.
const SCAN_CHUNK: usize = 8_192;
/// Threads reading commits at most; more only contend for the disk and the pack caches.
const MAX_SCAN_THREADS: usize = 16;

/// Text a commit must contain, ignoring case. Empty fields match everything.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct TextFilter {
    /// Part of the author's name or e-mail (`Name <email>`).
    pub author: Option<String>,
    /// Part of the message (subject and body).
    pub message: Option<String>,
}

impl TextFilter {
    /// Whether the filter matches every commit.
    pub fn is_empty(&self) -> bool {
        needle(self.author.as_deref()).is_none() && needle(self.message.as_deref()).is_none()
    }
}

/// A search word, lowercased once; `None` when blank.
fn needle(text: Option<&str>) -> Option<Needle> {
    let text = text?.trim();
    (!text.is_empty()).then(|| Needle {
        ascii: text.is_ascii(),
        lower: text.to_lowercase(),
    })
}

struct Needle {
    ascii: bool,
    lower: String,
}

impl Needle {
    /// Whether `haystack` contains the needle, ignoring case. ASCII needles fold the haystack
    /// byte by byte into `buffer`; others decode it (lossily) and lowercase it.
    fn found_in(&self, haystack: &[u8], buffer: &mut Vec<u8>) -> bool {
        if self.ascii {
            buffer.clear();
            buffer.extend(haystack.iter().map(u8::to_ascii_lowercase));
            buffer.find(self.lower.as_bytes()).is_some()
        } else {
            String::from_utf8_lossy(haystack)
                .to_lowercase()
                .contains(&self.lower)
        }
    }
}

/// Clears the flag of every shown commit of `index` whose author or message does not match.
/// Stops with [`GraphError::Cancelled`] once `cancel` is cancelled.
pub fn keep_matching(
    repo: &gix::ThreadSafeRepository,
    index: &CommitIndex,
    shown: &mut [bool],
    filter: &TextFilter,
    cancel: &CancellationToken,
) -> Result<(), GraphError> {
    let author = needle(filter.author.as_deref());
    let message = needle(filter.message.as_deref());
    if author.is_none() && message.is_none() {
        return Ok(());
    }
    let next = AtomicUsize::new(0);
    let threads = std::thread::available_parallelism()
        .map_or(1, std::num::NonZero::get)
        .min(MAX_SCAN_THREADS);
    let flags: &[bool] = shown;
    let rejected = std::thread::scope(|scope| {
        let workers: Vec<_> = (0..threads)
            .map(|_| {
                scope.spawn(|| {
                    let repo = repo.to_thread_local();
                    let mut rejected = Vec::new();
                    let mut buffer = Vec::new();
                    loop {
                        if cancel.is_cancelled() {
                            return Err(GraphError::Cancelled);
                        }
                        let start = next.fetch_add(SCAN_CHUNK, Ordering::Relaxed);
                        if start >= flags.len() {
                            return Ok(rejected);
                        }
                        let end = (start + SCAN_CHUNK).min(flags.len());
                        let chunk = flags[start..end].iter().enumerate();
                        for commit in chunk.filter(|(_, shown)| **shown).map(|(i, _)| start + i) {
                            let id = index.id(to_u32(commit));
                            let object = repo.find_commit(*id).map_err(GraphError::gix)?;
                            let matches = author.as_ref().is_none_or(|needle| {
                                object.author().is_ok_and(|signature| {
                                    let signature = signature.trim();
                                    needle.found_in(signature.name, &mut buffer)
                                        || needle.found_in(signature.email, &mut buffer)
                                })
                            }) && message.as_ref().is_none_or(|needle| {
                                object
                                    .message_raw()
                                    .is_ok_and(|text| needle.found_in(text, &mut buffer))
                            });
                            if !matches {
                                rejected.push(commit);
                            }
                        }
                    }
                })
            })
            .collect();
        workers
            .into_iter()
            .map(|worker| {
                worker
                    .join()
                    .unwrap_or_else(|_| Err(GraphError::Gix("a search thread failed".to_owned())))
            })
            .collect::<Result<Vec<_>, _>>()
    })?;
    for commit in rejected.into_iter().flatten() {
        shown[commit] = false;
    }
    Ok(())
}

fn to_u32(value: usize) -> u32 {
    u32::try_from(value).unwrap_or(u32::MAX)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn needles_ignore_case_and_blanks() {
        let mut buffer = Vec::new();
        let ascii = needle(Some(" Fix ")).unwrap();
        assert!(ascii.found_in(b"A small fix", &mut buffer));
        assert!(!ascii.found_in(b"Fi x", &mut buffer));
        let unicode = needle(Some("ŽLUŤOUČKÝ")).unwrap();
        assert!(unicode.found_in("příliš žluťoučký kůň".as_bytes(), &mut buffer));
        assert!(needle(Some("  ")).is_none());
        assert!(TextFilter::default().is_empty());
    }
}
