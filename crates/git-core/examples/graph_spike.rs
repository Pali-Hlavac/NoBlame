//! Spike for M2: opens a repository, builds the graph and prints phase timings.
//!
//! ```sh
//! cargo run --release -p git-core --example graph_spike -- .cache/repos/synthetic-1m
//! ```

// A measurement tool prints its results.
#![allow(clippy::print_stdout)]

use std::path::PathBuf;
use std::process::ExitCode;
use std::time::Instant;

use git_core::graph::{Graph, commit_details, commit_rows};
use git_core::repo::Repository;

/// Rows read for the "first screen" measurement.
const FIRST_SCREEN_ROWS: u32 = 60;

fn main() -> ExitCode {
    let Some(path) = std::env::args_os().nth(1).map(PathBuf::from) else {
        println!("usage: graph_spike <repository>");
        return ExitCode::FAILURE;
    };
    match run(&path) {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            println!("error: {error}");
            ExitCode::FAILURE
        }
    }
}

fn run(path: &std::path::Path) -> Result<(), Box<dyn std::error::Error>> {
    let started = Instant::now();
    let repo = Repository::discover(path)?;
    let opened = started.elapsed();
    let local = repo.local();
    let graph = Graph::build(&local)?;
    let built = started.elapsed();
    let first_block = graph.encode_block(0);
    let rows = commit_rows(&local, &graph, 0, FIRST_SCREEN_ROWS)?;
    let first_screen = started.elapsed();
    let t = graph.timings;

    println!("repository      {}", repo.info().git_dir.display());
    println!("commit-graph    {}", repo.info().has_commit_graph);
    println!("commits         {}", graph.row_count());
    println!("max lanes       {}", graph.max_lanes());
    println!("open            {opened:.1?}");
    println!("refs            {:.1?}", t.refs);
    println!("index           {:.1?}", t.index);
    println!("order           {:.1?}", t.order);
    println!("layout          {:.1?}", t.layout);
    println!("graph total     {:.1?}", built.saturating_sub(opened));
    println!(
        "first screen    {first_screen:.1?} (block 0: {} bytes, {} rows of text)",
        first_block.len(),
        rows.len()
    );

    let blocks = graph.block_count();
    let replay = Instant::now();
    let mut bytes = 0;
    for block in (0..blocks).step_by(usize::try_from((blocks / 50).max(1)).unwrap_or(1)) {
        bytes += graph.encode_block(block).len();
    }
    let sampled = blocks.div_ceil((blocks / 50).max(1));
    println!(
        "block replay    {:.2?} per block (avg {} bytes)",
        replay.elapsed() / sampled.max(1),
        bytes / sampled.max(1) as usize
    );
    // Worst case for "contained in": the oldest commit, below every other row.
    let last = graph.row_count().saturating_sub(1);
    let details = Instant::now();
    let oldest = commit_details(&local, &graph, last)?;
    println!(
        "details, oldest {:.1?} (contained in {} refs)",
        details.elapsed(),
        oldest.contained_in_total
    );
    if let Some(row) = rows.first() {
        println!(
            "top row         {} {} ({})",
            &row.id[..10],
            row.summary,
            row.author_name
        );
    }
    Ok(())
}
