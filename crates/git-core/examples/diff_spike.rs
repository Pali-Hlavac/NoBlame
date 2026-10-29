//! Spike for M3: diffs two blobs and prints how long computing and rendering a page take.
//!
//! ```sh
//! cargo run --release -p git-core --example diff_spike -- <repository> <old-blob> <new-blob>
//! ```
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
    let [path, old, new] = args.as_slice() else {
        println!("usage: diff_spike <repository> <old-blob> <new-blob>");
        return ExitCode::FAILURE;
    };
    match run(&PathBuf::from(path), old, new) {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            println!("error: {error}");
            ExitCode::FAILURE
        }
    }
}

fn run(path: &std::path::Path, old: &str, new: &str) -> Result<(), Box<dyn std::error::Error>> {
    let repo = Repository::discover(path)?.local();
    let (old, new) = (parse_object_id(old)?, parse_object_id(new)?);
    let started = Instant::now();
    let diff = file_diff(&repo, Some(old), Some(new), DiffOptions::default())?;
    let computed = started.elapsed();
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
