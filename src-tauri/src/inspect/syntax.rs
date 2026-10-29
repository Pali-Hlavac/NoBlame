//! Syntax colours of diff lines, as the UI takes them.

use git_core::diff::{SyntaxClass, SyntaxSpan};
use serde::Serialize;
use specta::Type;

/// What a coloured part of a line is.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum SyntaxClassDto {
    /// A comment.
    Comment,
    /// A string or character literal.
    String,
    /// A keyword or storage modifier.
    Keyword,
    /// A number or language constant.
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

/// Syntax spans as the UI takes them.
pub fn syntax_spans(spans: Vec<SyntaxSpan>) -> Vec<(u32, u32, SyntaxClassDto)> {
    spans
        .into_iter()
        .map(|(start, end, class)| {
            let class = match class {
                SyntaxClass::Comment => SyntaxClassDto::Comment,
                SyntaxClass::String => SyntaxClassDto::String,
                SyntaxClass::Keyword => SyntaxClassDto::Keyword,
                SyntaxClass::Constant => SyntaxClassDto::Constant,
                SyntaxClass::Type => SyntaxClassDto::Type,
                SyntaxClass::Function => SyntaxClassDto::Function,
                SyntaxClass::Tag => SyntaxClassDto::Tag,
                SyntaxClass::Attribute => SyntaxClassDto::Attribute,
            };
            (start, end, class)
        })
        .collect()
}
