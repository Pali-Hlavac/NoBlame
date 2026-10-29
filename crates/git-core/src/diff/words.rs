//! Word diff: which parts of a removed line changed in the added line paired with it. Lines are
//! split into words (letters, digits, `_`), runs of whitespace and single other characters; the
//! token sequences are diffed like lines are.

use std::ops::Range;

use gix::diff::blob::{Algorithm, Diff, InternedInput};

use super::options::Whitespace;

/// Longer lines (in bytes) are not compared word by word.
const MAX_WORD_DIFF_BYTES: usize = 1_000;
/// Lines that keep less than this share of their text (in tenths) are too different for word
/// highlights to help: nearly everything would be highlighted.
const MIN_UNCHANGED_TENTHS: usize = 3;
const TENTHS: usize = 10;

/// Changed parts of both lines, as `(start, end)` offsets in UTF-16 code units (what JavaScript
/// strings index by), sorted.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct WordChanges {
    /// In the removed line.
    pub old: Vec<(u32, u32)>,
    /// In the added line.
    pub new: Vec<(u32, u32)>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Class {
    Word,
    Space,
    Other,
}

fn class_of(c: char) -> Class {
    if c.is_alphanumeric() || c == '_' {
        Class::Word
    } else if c.is_whitespace() {
        Class::Space
    } else {
        Class::Other
    }
}

/// Byte ranges of the tokens of `text`.
fn tokens(text: &str) -> Vec<Range<usize>> {
    let mut tokens = Vec::new();
    let mut chars = text.char_indices().peekable();
    while let Some((start, c)) = chars.next() {
        let class = class_of(c);
        let mut end = start + c.len_utf8();
        if class != Class::Other {
            while let Some(&(next_start, next)) = chars.peek() {
                if class_of(next) != class {
                    break;
                }
                end = next_start + next.len_utf8();
                chars.next();
            }
        }
        tokens.push(start..end);
    }
    tokens
}

/// The tokens that take part in the comparison: whitespace only when it counts.
fn compared(text: &str, whitespace: Whitespace) -> Vec<Range<usize>> {
    let mut tokens = tokens(text);
    if matches!(whitespace, Whitespace::IgnoreChange | Whitespace::IgnoreAll) {
        tokens.retain(|token| !text[token.clone()].trim().is_empty());
    }
    tokens
}

/// The bytes from the first to the last token of `range`; `None` for an empty range.
fn span(tokens: &[Range<usize>], range: Range<u32>) -> Option<Range<usize>> {
    let first = tokens.get(range.start as usize)?;
    let last = tokens.get((range.end as usize).checked_sub(1)?)?;
    (range.start < range.end).then_some(first.start..last.end)
}

fn utf16(text: &str, ranges: &[Range<usize>]) -> Vec<(u32, u32)> {
    let offset =
        |byte: usize| u32::try_from(text[..byte].encode_utf16().count()).unwrap_or(u32::MAX);
    ranges
        .iter()
        .map(|range| (offset(range.start), offset(range.end)))
        .collect()
}

/// What changed between the removed line `old` and the added line `new`; `None` when the lines
/// are too long or too different to be worth highlighting, or nothing counted changed.
pub(super) fn word_changes(old: &str, new: &str, whitespace: Whitespace) -> Option<WordChanges> {
    if old.len() > MAX_WORD_DIFF_BYTES || new.len() > MAX_WORD_DIFF_BYTES {
        return None;
    }
    let (old_tokens, new_tokens) = (compared(old, whitespace), compared(new, whitespace));
    let mut input = InternedInput::default();
    input.update_before(old_tokens.iter().map(|token| &old[token.clone()]));
    input.update_after(new_tokens.iter().map(|token| &new[token.clone()]));
    let diff = Diff::compute(Algorithm::Myers, &input);

    let (mut old_changed, mut new_changed) = (Vec::new(), Vec::new());
    for hunk in diff.hunks() {
        old_changed.extend(span(&old_tokens, hunk.before));
        new_changed.extend(span(&new_tokens, hunk.after));
    }
    if old_changed.is_empty() && new_changed.is_empty() {
        return None;
    }
    let changed =
        |ranges: &[Range<usize>]| ranges.iter().map(ExactSizeIterator::len).sum::<usize>();
    let unchanged = old.len() + new.len() - changed(&old_changed) - changed(&new_changed);
    if unchanged * TENTHS < (old.len() + new.len()) * MIN_UNCHANGED_TENTHS {
        return None;
    }
    Some(WordChanges {
        old: utf16(old, &old_changed),
        new: utf16(new, &new_changed),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn changes(old: &str, new: &str) -> Option<WordChanges> {
        word_changes(old, new, Whitespace::Show)
    }

    #[test]
    fn highlights_the_changed_word() {
        let found = changes("let total = count + 1;", "let total = count + 2;");
        assert_eq!(
            found,
            Some(WordChanges {
                old: vec![(20, 21)],
                new: vec![(20, 21)]
            })
        );
    }

    #[test]
    fn highlights_insertions_only_on_the_new_side() {
        let new = "call(a, extra, b)";
        let found = changes("call(a, b)", new).unwrap_or_default();
        assert!(found.old.is_empty());
        let [(start, end)] = found.new[..] else {
            panic!("one inserted range expected: {found:?}");
        };
        // The inserted tokens are "extra", "," and " " in some order of placement.
        let inserted = &new[start as usize..end as usize];
        assert_eq!(inserted.len(), "extra, ".len());
        assert!(inserted.contains("extra"));
    }

    #[test]
    fn skips_lines_that_have_little_in_common() {
        assert_eq!(changes("completely different", "nothing alike here!"), None);
    }

    #[test]
    fn ignores_whitespace_when_asked() {
        assert!(changes("a  b", "a b").is_some());
        assert_eq!(word_changes("a  b", "a b", Whitespace::IgnoreChange), None);
    }

    #[test]
    fn offsets_count_utf16_units() {
        // "é" is one UTF-16 unit (two bytes); "😀" is two units (four bytes).
        let found = changes("é 😀 old", "é 😀 new");
        assert_eq!(found.map(|c| c.new), Some(vec![(5, 8)]));
    }

    #[test]
    fn skips_long_lines() {
        let long = "x ".repeat(MAX_WORD_DIFF_BYTES);
        assert_eq!(changes(&long, &format!("{long}y")), None);
    }
}
