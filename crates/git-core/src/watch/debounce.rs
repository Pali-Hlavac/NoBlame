//! Bursts of file system events turned into one call: after [`DEBOUNCE`](super::DEBOUNCE) of
//! quiet, or at most [`MAX_DELAY`] quiet periods after the burst began, so a build writing
//! without pause is still reported. Reads are dropped: inotify (Linux) reports files being
//! opened and closed, and the watcher's own ignore check reads `.git/index`, which would
//! otherwise come back as a change after every change.

use std::path::PathBuf;
use std::sync::mpsc;
use std::time::{Duration, Instant};

use notify::event::{AccessKind, AccessMode};
use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};

/// How many quiet periods a burst may last before it is reported anyway.
const MAX_DELAY: u32 = 4;

/// Watches `roots` recursively and calls `on_burst` on a background thread with the paths each
/// burst touched. Dropping the watcher stops the thread.
pub(super) fn watch(
    roots: &[PathBuf],
    quiet: Duration,
    on_burst: impl Fn(Vec<PathBuf>) + Send + 'static,
) -> notify::Result<RecommendedWatcher> {
    let (sender, receiver) = mpsc::channel::<Vec<PathBuf>>();
    let mut watcher = notify::recommended_watcher(move |result: notify::Result<Event>| {
        if let Ok(event) = result
            && !is_read(event.kind)
        {
            // The receiver is gone only when the debounce thread ended.
            let _ = sender.send(event.paths);
        }
    })?;
    for root in roots {
        watcher.watch(root, RecursiveMode::Recursive)?;
    }
    std::thread::Builder::new()
        .name("repo-watch".into())
        .spawn(move || debounce(&receiver, quiet, &on_burst))
        .map_err(notify::Error::io)?;
    Ok(watcher)
}

/// A file was opened, read or closed without being written.
fn is_read(kind: EventKind) -> bool {
    matches!(kind, EventKind::Access(access) if access != AccessKind::Close(AccessMode::Write))
}

/// Collects paths until `quiet` passes without one (or the burst is too long), then reports
/// them. Ends when the watcher, which holds the sender, is dropped.
fn debounce(
    receiver: &mpsc::Receiver<Vec<PathBuf>>,
    quiet: Duration,
    on_burst: &impl Fn(Vec<PathBuf>),
) {
    while let Ok(mut paths) = receiver.recv() {
        let deadline = Instant::now() + quiet * MAX_DELAY;
        loop {
            let left = deadline.saturating_duration_since(Instant::now());
            if left.is_zero() {
                break;
            }
            match receiver.recv_timeout(quiet.min(left)) {
                Ok(more) => paths.extend(more),
                Err(mpsc::RecvTimeoutError::Timeout) => break,
                Err(mpsc::RecvTimeoutError::Disconnected) => return,
            }
        }
        paths.sort();
        paths.dedup();
        on_burst(paths);
    }
}

#[cfg(test)]
mod tests {
    use notify::EventKind;
    use notify::event::{AccessKind, AccessMode, CreateKind, ModifyKind};

    use super::is_read;

    #[test]
    fn drops_reads_but_not_writes() {
        assert!(is_read(EventKind::Access(AccessKind::Open(
            AccessMode::Any
        ))));
        assert!(is_read(EventKind::Access(AccessKind::Close(
            AccessMode::Read
        ))));
        assert!(!is_read(EventKind::Access(AccessKind::Close(
            AccessMode::Write
        ))));
        assert!(!is_read(EventKind::Modify(ModifyKind::Any)));
        assert!(!is_read(EventKind::Create(CreateKind::File)));
    }
}
