//! How a file diff is computed: which whitespace changes count, and how many unchanged lines
//! surround each change. Lines are compared by a key with the ignored whitespace removed; the
//! rows still show the original text.

use std::borrow::Cow;

use gix::diff::blob::InternedInput;

use super::rows::CONTEXT_LINES;
use super::text::Side;

/// Context that shows the whole file around the changes.
pub const WHOLE_FILE_CONTEXT: u32 = u32::MAX;

/// Which whitespace changes count, as git's options name them.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Hash)]
pub enum Whitespace {
    /// Every change counts (`git diff`).
    #[default]
    Show,
    /// Whitespace at the end of a line is ignored (`--ignore-space-at-eol`).
    IgnoreAtEol,
    /// Changes in the amount of whitespace are ignored, and whitespace at the end of a line
    /// (`-b`).
    IgnoreChange,
    /// All whitespace is ignored (`-w`).
    IgnoreAll,
}

/// Options of one file diff; part of its cache key.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct DiffOptions {
    /// Which whitespace changes count.
    pub whitespace: Whitespace,
    /// Unchanged lines around each change; [`WHOLE_FILE_CONTEXT`] for the whole file.
    pub context: u32,
}

impl Default for DiffOptions {
    fn default() -> Self {
        Self {
            whitespace: Whitespace::Show,
            context: CONTEXT_LINES,
        }
    }
}

/// Git's whitespace characters (`isspace` without the newline).
fn is_space(byte: u8) -> bool {
    matches!(byte, b' ' | b'\t' | b'\r' | 0x0b | 0x0c)
}

/// The bytes a line (with its newline) is compared by.
pub(super) fn comparison_key(line: &[u8], whitespace: Whitespace) -> Cow<'_, [u8]> {
    if whitespace == Whitespace::Show {
        return Cow::Borrowed(line);
    }
    let (content, newline) = match line.strip_suffix(b"\n") {
        Some(content) => (content, true),
        None => (line, false),
    };
    let mut key = Vec::with_capacity(line.len());
    match whitespace {
        Whitespace::Show | Whitespace::IgnoreAtEol => {
            let end = content
                .iter()
                .rposition(|&byte| !is_space(byte))
                .map_or(0, |last| last + 1);
            key.extend_from_slice(&content[..end]);
        }
        Whitespace::IgnoreChange => {
            // Every run of whitespace becomes one space; a run at the end disappears.
            let mut in_space = false;
            for &byte in content {
                if is_space(byte) {
                    in_space = true;
                } else {
                    if in_space {
                        key.push(b' ');
                    }
                    in_space = false;
                    key.push(byte);
                }
            }
        }
        Whitespace::IgnoreAll => key.extend(content.iter().copied().filter(|&b| !is_space(b))),
    }
    if newline {
        key.push(b'\n');
    }
    Cow::Owned(key)
}

/// Both sides as interned comparison keys, ready for the diff algorithm.
pub(super) fn intern<'a>(
    old: &'a Side,
    new: &'a Side,
    whitespace: Whitespace,
) -> InternedInput<Cow<'a, [u8]>> {
    let mut input = InternedInput::default();
    input.reserve(old.line_count(), new.line_count());
    input.update_before(
        (0..old.line_count()).map(|line| comparison_key(old.raw_line(line), whitespace)),
    );
    input.update_after(
        (0..new.line_count()).map(|line| comparison_key(new.raw_line(line), whitespace)),
    );
    input
}
