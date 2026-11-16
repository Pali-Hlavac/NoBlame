//! Times searching the files of HEAD's tree for every word of a query, as the Files module's
//! filter box does.
//!
//! ```sh
//! cargo run --release -p git-core --example tree_search_spike -- <repository> <query>
//! ```

// A measurement tool prints its results.
#![allow(clippy::print_stdout)]

use std::process::ExitCode;
use std::time::Instant;

use git_core::tree_search::search_tree;

/// Searches timed (the first one is cold).
const RUNS: usize = 3;

fn main() -> ExitCode {
    let mut args = std::env::args().skip(1);
    let (Some(path), Some(query)) = (args.next(), args.next()) else {
        println!("usage: tree_search_spike <repository> <query>");
        return ExitCode::FAILURE;
    };
    let repo = match gix::open(&path) {
        Ok(repo) => repo,
        Err(error) => {
            println!("cannot open {path}: {error}");
            return ExitCode::FAILURE;
        }
    };
    let tree = match repo.head_commit().and_then(|commit| commit.tree_id()) {
        Ok(tree) => tree.detach(),
        Err(error) => {
            println!("cannot read HEAD's tree: {error}");
            return ExitCode::FAILURE;
        }
    };
    for run in 1..=RUNS {
        let started = Instant::now();
        match search_tree(&repo, tree, &query) {
            Ok(found) => println!(
                "run {run}: {} matches, {} rows{} in {:.1} ms",
                found.matches,
                found.rows.len(),
                if found.complete {
                    ""
                } else {
                    " (stopped at the limit)"
                },
                started.elapsed().as_secs_f64() * 1000.0
            ),
            Err(error) => {
                println!("search failed: {error}");
                return ExitCode::FAILURE;
            }
        }
    }
    ExitCode::SUCCESS
}
