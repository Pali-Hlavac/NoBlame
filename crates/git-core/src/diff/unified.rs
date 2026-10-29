//! Rendering unified rows, with the changed words of paired lines.

use super::file::FileDiff;
use super::highlight::PageSyntax;
use super::lines::{DiffLine, LineKind};
use super::rows::Row;
use super::text::{display_text, hunk_range};
use super::words::{WordChanges, word_changes};

impl FileDiff {
    /// Up to `count` unified rows from row `start`.
    pub fn lines(&self, start: u32, count: u32) -> Vec<DiffLine> {
        let start = (start as usize).min(self.rows.len());
        let end = start.saturating_add(count as usize).min(self.rows.len());
        let (mut old_lines, mut new_lines) = (Vec::new(), Vec::new());
        for row in &self.rows[start..end] {
            match *row {
                Row::Removed { old } => old_lines.push(old),
                Row::Context { new, .. } | Row::Added { new } => new_lines.push(new),
                Row::Hunk { .. } | Row::NoNewline => {}
            }
        }
        let syntax = self.page_syntax(&old_lines, &new_lines);
        (start..end)
            .map(|index| self.render(index, &syntax))
            .collect()
    }

    /// Changed words between removed line `old` and added line `new` (0-based).
    pub(super) fn words(&self, old: u32, new: u32) -> Option<WordChanges> {
        let (old_text, _) = display_text(self.old.line(old));
        let (new_text, _) = display_text(self.new.line(new));
        word_changes(&old_text, &new_text, self.whitespace)
    }

    /// Changed words of the pair that unified row `index` belongs to.
    fn pair_words(&self, index: usize) -> Option<WordChanges> {
        let partner = *self.partners.get(index)? as usize;
        match (self.rows.get(index)?, self.rows.get(partner)?) {
            (Row::Removed { old }, Row::Added { new })
            | (Row::Added { new }, Row::Removed { old }) => self.words(*old, *new),
            _ => None,
        }
    }

    fn render(&self, index: usize, (old_syntax, new_syntax): &PageSyntax) -> DiffLine {
        let line = |kind, old: Option<u32>, new: Option<u32>, bytes: &[u8]| {
            let (text, truncated) = display_text(bytes);
            // Removed lines are coloured as the old version, all others as the new one.
            let syntax = match (kind, old, new) {
                (LineKind::Removed, Some(old), _) => old_syntax.get(&old),
                (_, _, Some(new)) => new_syntax.get(&new),
                _ => None,
            };
            DiffLine {
                kind,
                old_line: old.map(|index| index + 1),
                new_line: new.map(|index| index + 1),
                text,
                truncated,
                highlights: Vec::new(),
                syntax: syntax.cloned().unwrap_or_default(),
            }
        };
        match self.rows[index] {
            Row::Hunk {
                old_start,
                old_len,
                new_start,
                new_len,
            } => DiffLine {
                kind: LineKind::Hunk,
                old_line: None,
                new_line: None,
                text: format!(
                    "@@ -{} +{} @@",
                    hunk_range(old_start, old_len),
                    hunk_range(new_start, new_len)
                ),
                truncated: false,
                highlights: Vec::new(),
                syntax: Vec::new(),
            },
            Row::Context { old, new } => {
                line(LineKind::Context, Some(old), Some(new), self.new.line(new))
            }
            Row::Removed { old } => DiffLine {
                highlights: self
                    .pair_words(index)
                    .map(|words| words.old)
                    .unwrap_or_default(),
                ..line(LineKind::Removed, Some(old), None, self.old.line(old))
            },
            Row::Added { new } => DiffLine {
                highlights: self
                    .pair_words(index)
                    .map(|words| words.new)
                    .unwrap_or_default(),
                ..line(LineKind::Added, None, Some(new), self.new.line(new))
            },
            Row::NoNewline => line(LineKind::NoNewline, None, None, &[]),
        }
    }
}
