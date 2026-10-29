//! Spike for M3: diffs two blobs and prints how long computing and rendering a page take.
//!
//! ```sh
//! cargo run --release -p git-core --example diff_spike -- <repository> <old-blob> <new-blob> [path]
//! ```
//!
//! With a path, the rows are syntax-highlighted as that file's language, and the last page is
//! timed twice: cold (parsing the whole side) and warm (from the saved parser states).
//!
//! Blob ids come from `git ls-tree -r -l HEAD` or `git rev-parse HEAD~1:path`.

// A measurement tool prints its results.
#![allow(clippy::print_stdout)]

use std::path::PathBuf;
use std::process::ExitCode;
use std::time::Instant;

use git_core::diff::{DiffOptions, file_diff, parse_object_id};
use git_core::repo::Repository;

/// Rows the diff tab asks for at once.
const PAGE_ROWS: u32 = 500;

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let (path, old, new, file) = match args.as_slice() {
        [path, old, new] => (path, old, new, None),
        [path, old, new, file] => (path, old, new, Some(file.as_str())),
        _ => {
            println!("usage: diff_spike <repository> <old-blob> <new-blob> [path]");
            return ExitCode::FAILURE;
        }
    };
    match run(&PathBuf::from(path), old, new, file) {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            println!("error: {error}");
            ExitCode::FAILURE
        }
    }
}

fn run(
    path: &std::path::Path,
    old: &str,
    new: &str,
    file: Option<&str>,
) -> Result<(), Box<dyn std::error::Error>> {
    let repo = Repository::discover(path)?.local();
    let (old, new) = (parse_object_id(old)?, parse_object_id(new)?);
    let started = Instant::now();
    let mut diff = file_diff(&repo, Some(old), Some(new), DiffOptions::default())?;
    let computed = started.elapsed();
    if let Some(file) = file {
        diff.highlight_as(file);
        let last = diff.row_count().saturating_sub(PAGE_ROWS);
        for attempt in ["cold", "warm"] {
            let started = Instant::now();
            let page = diff.lines(last, PAGE_ROWS);
            let coloured = page.iter().filter(|line| !line.syntax.is_empty()).count();
            println!(
                "syntax:   {:?} {attempt} (last page, {coloured} of {} rows coloured)",
                started.elapsed(),
                page.len()
            );
        }
    }
    let started = Instant::now();
    let middle = diff.row_count() / 2;
    let page = diff.lines(middle, PAGE_ROWS);
    let rendered = started.elapsed();
    println!("content:  {:?}", diff.content());
    println!(
        "sizes:    {} -> {} bytes, {} -> {} lines",
        diff.old_size(),
        diff.new_size(),
        diff.old_lines(),
        diff.new_lines()
    );
    println!(
        "changes:  +{} -{}, {} hunks, {} rows",
        diff.additions(),
        diff.deletions(),
        diff.hunk_count(),
        diff.row_count()
    );
    println!("memory:   {} KB", diff.memory_bytes() / 1024);
    println!("diff:     {computed:?} (read both blobs, compare, build rows)");
    println!(
        "page:     {rendered:?} ({} rows from the middle)",
        page.len()
    );
    Ok(())
}
