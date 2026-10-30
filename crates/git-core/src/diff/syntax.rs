//! Syntax highlighting of diff lines with syntect and the grammars `bat` ships (via two-face).
//! Each side is parsed along the lines the diff shows; the parser state is saved every
//! [`CHECKPOINT_LINES`] of them, so a page far down a diff costs its own lines (plus the shown
//! lines before it, once). Scopes are reduced to a few classes the UI colours.

use std::sync::{Mutex, OnceLock, PoisonError};

use gix::bstr::ByteSlice;
use syntect::parsing::{ParseState, Scope, ScopeStack, ScopeStackOp, SyntaxSet};

use super::text::Side;

/// Larger sides are not highlighted.
pub const MAX_HIGHLIGHT_BYTES: usize = 4 << 20;
/// Shown lines between saved parser states.
const CHECKPOINT_LINES: u32 = 256;

/// What a highlighted part of a line is.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SyntaxClass {
    /// A comment.
    Comment,
    /// A string or character literal.
    String,
    /// A keyword or storage modifier.
    Keyword,
    /// A number or language constant (`true`, `null`).
    Constant,
    /// A type name.
    Type,
    /// A function name.
    Function,
    /// A markup tag.
    Tag,
    /// A markup attribute name.
    Attribute,
}

/// A highlighted part of a line: `(start, end)` in UTF-16 code units, and its class.
pub type SyntaxSpan = (u32, u32, SyntaxClass);

/// Scope prefixes and their classes, checked in order; `None` stops the search (operators are
/// keywords in most grammars but would only add noise).
const SCOPE_CLASSES: &[(&str, Option<SyntaxClass>)] = &[
    ("comment", Some(SyntaxClass::Comment)),
    ("string", Some(SyntaxClass::String)),
    ("constant.numeric", Some(SyntaxClass::Constant)),
    ("constant.language", Some(SyntaxClass::Constant)),
    ("constant.character", Some(SyntaxClass::Constant)),
    ("entity.name.function", Some(SyntaxClass::Function)),
    ("support.function", Some(SyntaxClass::Function)),
    ("variable.function", Some(SyntaxClass::Function)),
    ("entity.name.type", Some(SyntaxClass::Type)),
    ("entity.name.class", Some(SyntaxClass::Type)),
    ("entity.name.struct", Some(SyntaxClass::Type)),
    ("entity.name.enum", Some(SyntaxClass::Type)),
    ("support.type", Some(SyntaxClass::Type)),
    ("support.class", Some(SyntaxClass::Type)),
    ("entity.name.tag", Some(SyntaxClass::Tag)),
    ("entity.other.attribute-name", Some(SyntaxClass::Attribute)),
    ("keyword.operator", None),
    ("keyword", Some(SyntaxClass::Keyword)),
    ("storage", Some(SyntaxClass::Keyword)),
];

fn syntaxes() -> &'static SyntaxSet {
    static SET: OnceLock<SyntaxSet> = OnceLock::new();
    SET.get_or_init(two_face::syntax::extra_newlines)
}

fn scope_classes() -> &'static [(Scope, Option<SyntaxClass>)] {
    static CLASSES: OnceLock<Vec<(Scope, Option<SyntaxClass>)>> = OnceLock::new();
    CLASSES.get_or_init(|| {
        SCOPE_CLASSES
            .iter()
            .filter_map(|&(name, class)| Scope::new(name).ok().map(|scope| (scope, class)))
            .collect()
    })
}

/// The class of the innermost scope that has one.
fn class_of(stack: &ScopeStack) -> Option<SyntaxClass> {
    for scope in stack.as_slice().iter().rev() {
        let found = scope_classes()
            .iter()
            .find(|(prefix, _)| prefix.is_prefix_of(*scope));
        if let Some(&(_, class)) = found {
            return class;
        }
    }
    None
}

/// Highlights the lines of one side of a diff.
///
/// Only the lines the diff shows are parsed, in order, carrying the parser state across the
/// unchanged lines in between (as `delta` does): a page costs its own lines, not the file
/// around them. A construct opened between two hunks (a block comment) can be missed; with the
/// whole file as context nothing is skipped.
#[derive(Debug)]
pub(super) struct Highlighter {
    /// The lines of the side that the diff shows, ascending.
    shown: Vec<u32>,
    /// Parser state before shown line number `i * CHECKPOINT_LINES`.
    checkpoints: Mutex<Vec<(ParseState, ScopeStack)>>,
}

impl Highlighter {
    /// A highlighter for the `shown` lines (ascending) of `side` of the file at `path`, if its
    /// language is known (by extension, file name or first line) and the side is small enough.
    pub fn for_file(path: &str, side: &Side, shown: Vec<u32>) -> Option<Self> {
        if side.data.len() > MAX_HIGHLIGHT_BYTES || shown.is_empty() {
            return None;
        }
        let set = syntaxes();
        let name = path.rsplit('/').next().unwrap_or(path);
        let extension = name
            .rsplit_once('.')
            .map_or(name, |(_, extension)| extension);
        let syntax = set
            .find_syntax_by_extension(extension)
            .or_else(|| set.find_syntax_by_extension(name))
            .or_else(|| set.find_syntax_by_first_line(&side.line(0).to_str_lossy()))?;
        if syntax.name == set.find_syntax_plain_text().name {
            return None;
        }
        Some(Self {
            shown,
            checkpoints: Mutex::new(vec![(ParseState::new(syntax), ScopeStack::new())]),
        })
    }

    /// The highlighted parts of `lines` (0-based, ascending, among the shown lines) of `side`.
    pub fn spans(&self, side: &Side, lines: &[u32]) -> Vec<(u32, Vec<SyntaxSpan>)> {
        let (Some(&first), Some(&last)) = (lines.first(), lines.last()) else {
            return Vec::new();
        };
        // Positions in the shown lines.
        let first = self.shown.partition_point(|&line| line < first);
        let last = self.shown.partition_point(|&line| line <= last);
        // Each update only appends whole states, so a poisoned lock still holds valid ones.
        let mut checkpoints = self
            .checkpoints
            .lock()
            .unwrap_or_else(PoisonError::into_inner);
        let step = CHECKPOINT_LINES as usize;
        let from = (first / step).min(checkpoints.len() - 1);
        let (mut state, mut stack) = checkpoints[from].clone();
        let mut wanted = lines.iter().copied().peekable();
        let mut found = Vec::new();
        for position in from * step..last {
            if position.is_multiple_of(step) && position / step == checkpoints.len() {
                checkpoints.push((state.clone(), stack.clone()));
            }
            let line = self.shown[position];
            let text = side.raw_line(line).to_str_lossy();
            let Ok(ops) = state.parse_line(&text, syntaxes()) else {
                break;
            };
            while wanted.next_if(|&wanted| wanted < line).is_some() {}
            let keep = wanted.next_if_eq(&line).is_some();
            let spans = apply(&text, &ops, &mut stack, keep);
            if keep {
                found.push((line, spans));
            }
        }
        found
    }
}

/// Applies a line's scope changes to `stack`; with `keep`, also returns its highlighted parts.
fn apply(
    text: &str,
    ops: &[(usize, ScopeStackOp)],
    stack: &mut ScopeStack,
    keep: bool,
) -> Vec<SyntaxSpan> {
    let mut spans: Vec<(usize, usize, SyntaxClass)> = Vec::new();
    // Scopes may run through the line ending, which is not shown.
    let content = text.trim_end_matches(['\n', '\r']).len();
    let mut push = |stack: &ScopeStack, start: usize, end: usize| {
        let end = end.min(content);
        let Some(class) = class_of(stack).filter(|_| keep && start < end) else {
            return;
        };
        match spans.last_mut() {
            Some(last) if last.1 == start && last.2 == class => last.1 = end,
            _ => spans.push((start, end, class)),
        }
    };
    let mut position = 0;
    for (at, op) in ops {
        push(stack, position, *at);
        // A grammar error only spoils the colours of this file, never the diff.
        let _ = stack.apply(op);
        position = *at;
    }
    push(stack, position, content);
    utf16(text, &spans)
}

/// Byte ranges to UTF-16 ranges (what JavaScript strings index by).
fn utf16(text: &str, spans: &[(usize, usize, SyntaxClass)]) -> Vec<SyntaxSpan> {
    let mut chars = text.char_indices().peekable();
    let mut units = 0u32;
    let mut offset = |byte: usize| {
        while let Some(&(index, c)) = chars.peek() {
            if index >= byte {
                break;
            }
            units += if c.len_utf16() == 2 { 2 } else { 1 };
            chars.next();
        }
        units
    };
    spans
        .iter()
        .map(|&(start, end, class)| (offset(start), offset(end), class))
        .collect()
}

#[cfg(test)]
#[path = "syntax_tests.rs"]
mod tests;
