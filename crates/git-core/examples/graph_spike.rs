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
    // Worst case for the highlighted history: the newest commit, every block below it lit.
    let highlight = Instant::now();
    if let Some(mut ancestry) = graph.ancestry(0) {
        let first = highlight.elapsed();
        let _ = graph.encode_ancestry_block(&mut ancestry, 0);
        let first_block = highlight.elapsed();
        let _ = graph.encode_ancestry_block(&mut ancestry, blocks.saturating_sub(1));
        println!(
            "history, top    {first:.1?} find, {first_block:.1?} first block, {:.1?} last block",
            highlight.elapsed()
        );
    }
    // Reusing the index (what a reload after a commit and the on-disk cache do).
    let lookup = Instant::now();
    if let Some(first) = graph.index().len().checked_sub(1) {
        let _ = graph
            .index()
            .lookup(graph.index().id(u32::try_from(first).unwrap_or(0)));
    }
    let sorted = lookup.elapsed();
    let reuse = Instant::now();
    let rebuilt = Graph::build_with(&local, Some(graph.index()))?;
    println!(
        "reuse index     {sorted:.1?} sort ids, rebuild {:.1?} (index {:.1?})",
        reuse.elapsed(),
        rebuilt.timings.index
    );
    let write = Instant::now();
    let mut bytes = Vec::new();
    graph.index().write_to(&mut bytes)?;
    let written = write.elapsed();
    let read = Instant::now();
    let cached = git_core::graph::CommitIndex::read_from(&bytes)?;
    println!(
        "cache file      {} KiB, encode {written:.1?}, decode+validate {:.1?}, {} commits",
        bytes.len() / 1024,
        read.elapsed(),
        cached.len()
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
