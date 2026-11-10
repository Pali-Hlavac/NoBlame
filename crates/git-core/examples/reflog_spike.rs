//! Spike for M6: times reading a reflog (newest first, at most `MAX_REFLOG_ENTRIES`) and listing
//! the references that have one, as the Reflog module does.
//!
//! ```sh
//! cargo run --release -p git-core --example reflog_spike -- <repository> [reference]
//! ```

// A measurement tool prints its results.
#![allow(clippy::print_stdout)]

use std::process::ExitCode;
use std::time::Instant;

use git_core::reflog::{reflog, reflog_references};

/// Reads timed (the first one is cold).
const RUNS: usize = 3;

fn main() -> ExitCode {
    let mut args = std::env::args().skip(1);
    let Some(path) = args.next() else {
        println!("usage: reflog_spike <repository> [reference]");
        return ExitCode::FAILURE;
    };
    let reference = args.next().unwrap_or_else(|| "HEAD".to_owned());
    let repo = match gix::open(&path) {
        Ok(repo) => repo,
        Err(error) => {
            println!("cannot open {path}: {error}");
            return ExitCode::FAILURE;
        }
    };
    for run in 1..=RUNS {
        let started = Instant::now();
        match reflog(&repo, &reference) {
            Ok(log) => println!(
                "run {run}: {} entries{} in {:.1} ms",
                log.entries.len(),
                if log.truncated { " (truncated)" } else { "" },
                started.elapsed().as_secs_f64() * 1000.0
            ),
            Err(error) => {
                println!("cannot read the reflog: {error}");
                return ExitCode::FAILURE;
            }
        }
    }
    let started = Instant::now();
    match reflog_references(&repo) {
        Ok(names) => println!(
            "{} references with a reflog in {:.1} ms",
            names.len(),
            started.elapsed().as_secs_f64() * 1000.0
        ),
        Err(error) => println!("cannot list the references: {error}"),
    }
    ExitCode::SUCCESS
}
