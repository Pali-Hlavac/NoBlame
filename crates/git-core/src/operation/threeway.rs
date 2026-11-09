//! The three-way merge of one file's lines (diff3) for the built-in merge view: the base, ours
//! and theirs are each diffed against the base, and the base is walked in order. Lines only one
//! side changed are taken from it; lines both changed alike are taken once; lines both changed
//! differently are a conflict. As in git, changes that touch (one ends where the other starts)
//! conflict too. Conflicts are then narrowed (as git's default "zealous" level does): lines at
//! their start and end that ours and theirs share are taken as resolved; where the base had
//! nothing (both sides added lines there), the conflict is split wherever ours and theirs agree.

use std::ops::Range;

use gix::diff::blob::{Algorithm, Diff, InternedInput};

/// Where resolved lines come from.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ChunkSource {
    /// Neither side changed them.
    Unchanged,
    /// Only ours changed them.
    Ours,
    /// Only theirs changed them.
    Theirs,
    /// Both sides made the same change.
    Both,
}

/// A run of lines of the merged file: resolved, or a conflict to decide.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum MergeChunk {
    /// Lines the merge decided by itself, with their line endings.
    Resolved {
        /// Who changed them.
        source: ChunkSource,
        /// The lines.
        text: Vec<u8>,
    },
    /// Lines both sides changed differently.
    Conflict {
        /// The lines before either change (empty where both sides added lines).
        base: Vec<u8>,
        /// Our version of them.
        ours: Vec<u8>,
        /// Their version of them.
        theirs: Vec<u8>,
    },
}

/// One side's change against the base: base lines `base` became the side's lines `side`.
struct Change {
    base: Range<usize>,
    side: Range<usize>,
}

impl Change {
    /// How many lines longer the side is than the base here.
    fn growth(&self) -> isize {
        self.side.len().cast_signed() - self.base.len().cast_signed()
    }
}

/// Lines with their endings; a last line without a newline is a line too.
fn lines(data: &[u8]) -> Vec<&[u8]> {
    data.split_inclusive(|byte| *byte == b'\n').collect()
}

fn changes(before: &[&[u8]], after: &[&[u8]]) -> Vec<Change> {
    let mut input = InternedInput::default();
    input.update_before(before.iter().copied());
    input.update_after(after.iter().copied());
    let mut diff = Diff::compute(Algorithm::Histogram, &input);
    diff.postprocess_lines(&input);
    diff.hunks()
        .map(|hunk| Change {
            base: hunk.before.start as usize..hunk.before.end as usize,
            side: hunk.after.start as usize..hunk.after.end as usize,
        })
        .collect()
}

/// `position` in the base moved by `delta` lines (what a side inserted minus what it removed
/// before it).
fn shift(position: usize, delta: isize) -> usize {
    position.saturating_add_signed(delta)
}

/// The chunks of the merge, collected with neighbours of the same source joined.
#[derive(Default)]
struct Chunks(Vec<MergeChunk>);

impl Chunks {
    fn resolved(&mut self, source: ChunkSource, lines: &[&[u8]]) {
        if lines.is_empty() {
            return;
        }
        if let Some(MergeChunk::Resolved { source: last, text }) = self.0.last_mut()
            && *last == source
        {
            text.extend(lines.concat());
            return;
        }
        self.0.push(MergeChunk::Resolved {
            source,
            text: lines.concat(),
        });
    }

    fn conflict(&mut self, base: &[&[u8]], ours: &[&[u8]], theirs: &[&[u8]]) {
        self.0.push(MergeChunk::Conflict {
            base: base.concat(),
            ours: ours.concat(),
            theirs: theirs.concat(),
        });
    }

    /// A conflict, narrowed to the lines ours and theirs do not share.
    fn narrowed_conflict(&mut self, base: &[&[u8]], ours: &[&[u8]], theirs: &[&[u8]]) {
        let common = |a: &[&[u8]], b: &[&[u8]], from_end: bool| {
            let pairs = a.len().min(b.len());
            (0..pairs)
                .take_while(|&i| {
                    if from_end {
                        a[a.len() - 1 - i] == b[b.len() - 1 - i]
                    } else {
                        a[i] == b[i]
                    }
                })
                .count()
        };
        let head = common(ours, theirs, false);
        let tail = common(&ours[head..], &theirs[head..], true);
        self.resolved(ChunkSource::Both, &ours[..head]);
        let (ours_rest, theirs_rest) = (
            &ours[head..ours.len() - tail],
            &theirs[head..theirs.len() - tail],
        );
        if base.is_empty() {
            self.split_additions(ours_rest, theirs_rest);
        } else {
            self.conflict(base, ours_rest, theirs_rest);
        }
        self.resolved(ChunkSource::Both, &ours[ours.len() - tail..]);
    }

    /// Lines both sides added at one place: the lines they agree on are taken, the rest are
    /// conflicts (with no base).
    fn split_additions(&mut self, ours: &[&[u8]], theirs: &[&[u8]]) {
        let mut at = (0, 0);
        for change in changes(ours, theirs) {
            self.resolved(ChunkSource::Both, &ours[at.0..change.base.start]);
            self.conflict(
                &[],
                &ours[change.base.clone()],
                &theirs[change.side.clone()],
            );
            at = (change.base.end, change.side.end);
        }
        self.resolved(ChunkSource::Both, &ours[at.0..]);
    }
}

/// Merges `ours` and `theirs`, both made from `base`, line by line (bytes: any encoding whose
/// lines end in `\n`). The chunks' texts put together are the merged file once each conflict
/// is decided.
#[must_use]
pub fn merge_chunks(base: &[u8], ours: &[u8], theirs: &[u8]) -> Vec<MergeChunk> {
    let (base, ours, theirs) = (lines(base), lines(ours), lines(theirs));
    let (by_ours, by_theirs) = (changes(&base, &ours), changes(&base, &theirs));
    let mut chunks = Chunks::default();
    let (mut next_ours, mut next_theirs) = (0, 0);
    let (mut delta_ours, mut delta_theirs) = (0_isize, 0_isize);
    let mut done = 0;
    loop {
        let start = match (by_ours.get(next_ours), by_theirs.get(next_theirs)) {
            (Some(a), Some(b)) => a.base.start.min(b.base.start),
            (Some(a), None) => a.base.start,
            (None, Some(b)) => b.base.start,
            (None, None) => break,
        };
        let (ours_start, theirs_start) = (shift(start, delta_ours), shift(start, delta_theirs));
        let (first_ours, first_theirs) = (next_ours, next_theirs);
        let mut end = start;
        // Take every change of either side that overlaps or touches the region.
        loop {
            if let Some(a) = by_ours.get(next_ours).filter(|a| a.base.start <= end) {
                end = end.max(a.base.end);
                delta_ours += a.growth();
                next_ours += 1;
            } else if let Some(b) = by_theirs.get(next_theirs).filter(|b| b.base.start <= end) {
                end = end.max(b.base.end);
                delta_theirs += b.growth();
                next_theirs += 1;
            } else {
                break;
            }
        }
        chunks.resolved(ChunkSource::Unchanged, &base[done..start]);
        let ours_lines = &ours[ours_start..shift(end, delta_ours)];
        let theirs_lines = &theirs[theirs_start..shift(end, delta_theirs)];
        match (next_ours > first_ours, next_theirs > first_theirs) {
            (true, false) => chunks.resolved(ChunkSource::Ours, ours_lines),
            (false, true) => chunks.resolved(ChunkSource::Theirs, theirs_lines),
            _ if ours_lines == theirs_lines => chunks.resolved(ChunkSource::Both, ours_lines),
            _ => chunks.narrowed_conflict(&base[start..end], ours_lines, theirs_lines),
        }
        done = end;
    }
    chunks.resolved(ChunkSource::Unchanged, &base[done..]);
    chunks.0
}

#[cfg(test)]
#[path = "threeway_tests.rs"]
mod tests;
