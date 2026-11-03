//! Taking some of a file's changed lines: the contents a partial stage, unstage or discard
//! writes. Both versions are compared exactly (every whitespace change counts), and each
//! changed line is kept or taken on its own, so any choice of lines gives a valid file.

use std::ops::RangeInclusive;

use gix::diff::blob::{Algorithm, InternedInput, diff_with_slider_heuristics};

/// Changed lines chosen by their 1-based numbers: removed lines by their number in the old
/// version, added lines by their number in the new one. A range may include unchanged lines
/// (a whole hunk with its context); those are ignored.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct LineSelection {
    /// Lines of the old version.
    pub removed: Vec<RangeInclusive<u32>>,
    /// Lines of the new version.
    pub added: Vec<RangeInclusive<u32>>,
}

impl LineSelection {
    /// Nothing is chosen.
    pub fn is_empty(&self) -> bool {
        self.removed
            .iter()
            .chain(&self.added)
            .all(RangeInclusive::is_empty)
    }

    fn has_removed(&self, index: u32) -> bool {
        self.removed
            .iter()
            .any(|range| range.contains(&(index + 1)))
    }

    fn has_added(&self, index: u32) -> bool {
        self.added.iter().any(|range| range.contains(&(index + 1)))
    }
}

/// Which way the chosen lines go.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Take {
    /// Start from `old` and make the chosen changes (staging lines).
    Chosen,
    /// Start from `new` and undo the chosen changes (unstaging or discarding lines).
    AllButChosen,
}

/// `old` with the changes towards `new` that `take` and `selection` pick: a removed line goes
/// away when its change is taken, an added line comes in when its change is taken.
pub fn combine(
    old: &[u8],
    new: &[u8],
    algorithm: Algorithm,
    selection: &LineSelection,
    take: Take,
) -> Vec<u8> {
    let old_lines: Vec<&[u8]> = old.split_inclusive(|&byte| byte == b'\n').collect();
    let new_lines: Vec<&[u8]> = new.split_inclusive(|&byte| byte == b'\n').collect();
    let mut input = InternedInput::default();
    input.reserve(to_u32(old_lines.len()), to_u32(new_lines.len()));
    input.update_before(old_lines.iter().copied());
    input.update_after(new_lines.iter().copied());
    let diff = diff_with_slider_heuristics(algorithm, &input);
    let taken = |chosen: bool| match take {
        Take::Chosen => chosen,
        Take::AllButChosen => !chosen,
    };

    let mut out = Vec::with_capacity(old.len().max(new.len()));
    let mut next_old = 0;
    for hunk in diff.hunks() {
        for line in next_old..hunk.before.start {
            push_line(&mut out, old_lines[line as usize]);
        }
        for line in hunk.before.clone() {
            if !taken(selection.has_removed(line)) {
                push_line(&mut out, old_lines[line as usize]);
            }
        }
        for line in hunk.after.clone() {
            if taken(selection.has_added(line)) {
                push_line(&mut out, new_lines[line as usize]);
            }
        }
        next_old = hunk.before.end;
    }
    for line in old_lines.iter().skip(next_old as usize) {
        push_line(&mut out, line);
    }
    out
}

/// Appends a line. A line without a newline (the end of a version) that is no longer last gets
/// one, so it is not joined with the next.
fn push_line(out: &mut Vec<u8>, line: &[u8]) {
    if out.last().is_some_and(|&byte| byte != b'\n') {
        out.push(b'\n');
    }
    out.extend_from_slice(line);
}

fn to_u32(value: usize) -> u32 {
    u32::try_from(value).unwrap_or(u32::MAX)
}

#[cfg(test)]
mod tests {
    use super::*;

    const OLD: &[u8] = b"one\ntwo\nthree\nfour\n";
    const NEW: &[u8] = b"one\n2\nthree\nfour\nfive\n";

    fn lines(removed: &[u32], added: &[u32]) -> LineSelection {
        LineSelection {
            removed: removed.iter().map(|&line| line..=line).collect(),
            added: added.iter().map(|&line| line..=line).collect(),
        }
    }

    fn run(selection: &LineSelection, take: Take) -> String {
        String::from_utf8(combine(OLD, NEW, Algorithm::Myers, selection, take)).unwrap()
    }

    #[test]
    fn takes_only_the_chosen_lines() {
        // Remove "two" without adding "2"; add "five".
        assert_eq!(
            run(&lines(&[2], &[5]), Take::Chosen),
            "one\nthree\nfour\nfive\n"
        );
        assert_eq!(
            run(&lines(&[], &[2]), Take::Chosen),
            "one\ntwo\n2\nthree\nfour\n"
        );
        assert_eq!(
            run(&LineSelection::default(), Take::Chosen),
            "one\ntwo\nthree\nfour\n"
        );
    }

    #[test]
    fn undoes_only_the_chosen_lines() {
        // From NEW, undo adding "five": NEW without it.
        assert_eq!(
            run(&lines(&[], &[5]), Take::AllButChosen),
            "one\n2\nthree\nfour\n"
        );
        assert_eq!(
            run(&LineSelection::default(), Take::AllButChosen),
            "one\n2\nthree\nfour\nfive\n"
        );
    }

    #[test]
    fn a_whole_range_with_context_takes_every_change_in_it() {
        let selection = LineSelection {
            removed: vec![1..=4],
            added: vec![1..=5],
        };
        assert_eq!(run(&selection, Take::Chosen), "one\n2\nthree\nfour\nfive\n");
    }

    #[test]
    fn keeps_lines_apart_when_the_last_one_had_no_newline() {
        let old = b"a";
        let new = b"a\nb\n";
        // "a" (no newline) is replaced by "a\n"; taking only "b" must not give "ab".
        let selection = lines(&[], &[2]);
        let out = combine(old, new, Algorithm::Myers, &selection, Take::Chosen);
        assert_eq!(out, b"a\nb\n");
    }

    #[test]
    fn keeps_crlf_line_endings_as_they_are() {
        let old = b"a\r\nb\r\n";
        let new = b"a\r\nB\r\n";
        let out = combine(old, new, Algorithm::Myers, &lines(&[2], &[2]), Take::Chosen);
        assert_eq!(out, b"a\r\nB\r\n");
    }
}
