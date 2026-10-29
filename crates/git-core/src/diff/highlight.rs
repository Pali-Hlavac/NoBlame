//! Syntax highlighting of a [`FileDiff`]'s rows: turned on per file by its path, looked up for
//! the lines of one page at a time.

use std::collections::HashMap;

use super::file::FileDiff;
use super::lines::DiffContent;
use super::rows::Row;
use super::syntax::{Highlighter, SyntaxSpan};

/// Highlighted parts by 0-based line, for the old and the new side.
pub(super) type PageSyntax = (HashMap<u32, Vec<SyntaxSpan>>, HashMap<u32, Vec<SyntaxSpan>>);

impl FileDiff {
    /// Highlights the rows as the language of `path` (by extension, file name or first line);
    /// does nothing for unknown languages, binary files and sides over 4 MB.
    pub fn highlight_as(&mut self, path: &str) {
        if self.content() != DiffContent::Text {
            return;
        }
        let (mut old_shown, mut new_shown) = (Vec::new(), Vec::new());
        for row in &self.rows {
            match *row {
                Row::Context { old, new } => {
                    old_shown.push(old);
                    new_shown.push(new);
                }
                Row::Removed { old } => old_shown.push(old),
                Row::Added { new } => new_shown.push(new),
                Row::Hunk { .. } | Row::NoNewline => {}
            }
        }
        self.old_syntax = Highlighter::for_file(path, &self.old, old_shown);
        self.new_syntax = Highlighter::for_file(path, &self.new, new_shown);
    }

    /// The highlighted parts of `old_lines` and `new_lines` (ascending).
    pub(super) fn page_syntax(&self, old_lines: &[u32], new_lines: &[u32]) -> PageSyntax {
        let spans = |highlighter: &Option<Highlighter>, side, lines| {
            highlighter
                .as_ref()
                .map(|highlighter| highlighter.spans(side, lines))
                .unwrap_or_default()
                .into_iter()
                .collect()
        };
        (
            spans(&self.old_syntax, &self.old, old_lines),
            spans(&self.new_syntax, &self.new, new_lines),
        )
    }
}
