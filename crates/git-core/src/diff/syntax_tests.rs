//! Syntax highlighting of single lines and across checkpoints.

use super::*;

fn highlight(path: &str, text: &str) -> Vec<(u32, Vec<SyntaxSpan>)> {
    let side = Side::new(text.as_bytes().to_vec());
    let lines: Vec<u32> = (0..side.line_count()).collect();
    Highlighter::for_file(path, &side, lines.clone())
        .map_or_else(Vec::new, |h| h.spans(&side, &lines))
}

fn classes_of(spans: &[SyntaxSpan], text: &str) -> Vec<(String, SyntaxClass)> {
    let units: Vec<u16> = text.encode_utf16().collect();
    spans
        .iter()
        .map(|&(start, end, class)| {
            let part = String::from_utf16_lossy(&units[start as usize..end as usize]);
            (part, class)
        })
        .collect()
}

#[test]
fn colours_rust_by_its_extension() {
    let line = "fn main() { let s = \"hi\"; } // done";
    let found = highlight("src/main.rs", &format!("{line}\n"));
    let classes = classes_of(&found[0].1, line);
    assert!(classes.contains(&("fn".to_owned(), SyntaxClass::Keyword)));
    assert!(classes.contains(&("main".to_owned(), SyntaxClass::Function)));
    assert!(classes.contains(&("\"hi\"".to_owned(), SyntaxClass::String)));
    assert!(classes.contains(&("// done".to_owned(), SyntaxClass::Comment)));
}

#[test]
fn keeps_state_across_lines_and_checkpoints() {
    // A block comment opened on line 300 colours line 301 as a comment.
    let mut text: String = "let x = 1;\n".repeat(300);
    text.push_str("/* start\nstill a comment */\n");
    let side = Side::new(text.into_bytes());
    let shown = (0..side.line_count()).collect();
    let highlighter = Highlighter::for_file("a.rs", &side, shown).unwrap_or_else(|| panic!("Rust"));
    let found = highlighter.spans(&side, &[301]);
    assert_eq!(found[0].1, vec![(0, 18, SyntaxClass::Comment)]);
    // Asking again, from the saved checkpoint, gives the same answer.
    assert_eq!(highlighter.spans(&side, &[301]), found);
}

#[test]
fn colours_languages_beyond_sublimes_defaults() {
    for (path, line, keyword) in [
        ("web/app.ts", "const total: number = 1;", "const"),
        ("web/App.tsx", "export function App() {}", "function"),
        ("Cargo.toml", "name = \"noblame\"", "\"noblame\""),
        ("build.gradle.kts", "val x = 1", "val"),
        ("Dockerfile", "FROM rust:1", "FROM"),
    ] {
        let found = highlight(path, &format!("{line}\n"));
        let classes = classes_of(found.first().map_or(&[][..], |row| &row.1), line);
        assert!(
            classes.iter().any(|(part, _)| part == keyword),
            "{path}: {classes:?}"
        );
    }
}

#[test]
fn skips_unknown_languages() {
    assert!(highlight("notes.unknown-extension", "plain words\n").is_empty());
}

#[test]
fn offsets_count_utf16_units() {
    let line = "let s = \"😀\";";
    let found = highlight("a.rs", &format!("{line}\n"));
    let classes = classes_of(&found[0].1, line);
    assert!(classes.contains(&("\"😀\"".to_owned(), SyntaxClass::String)));
}
