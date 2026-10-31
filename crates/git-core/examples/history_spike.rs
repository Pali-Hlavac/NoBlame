//! Spike for M3: times a file's history from HEAD (following renames) and its blame there.
//!
//! ```sh
//! cargo run --release -p git-core --example history_spike -- <repository> <path>
//! ```

// A measurement tool prints its results.
#![allow(clippy::print_stdout)]

use std::path::{Path, PathBuf};
use std::process::ExitCode;
use std::time::Instant;

use git_core::blame::blame;
use git_core::cli::Git;
use git_core::history::file_history;
use git_core::repo::Repository;
use tokio_util::sync::CancellationToken;

#[tokio::main(flavor = "current_thread")]
async fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let [repository, path] = args.as_slice() else {
        println!("usage: history_spike <repository> <path>");
        return ExitCode::FAILURE;
    };
    match run(&PathBuf::from(repository), path).await {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            println!("error: {error}");
            ExitCode::FAILURE
        }
    }
}

async fn run(dir: &Path, path: &str) -> Result<(), Box<dyn std::error::Error>> {
    let repo = Repository::discover(dir)?;
    let head = repo.local().head_id()?.detach();
    let git = Git::locate()?;
    let cancel = CancellationToken::new();
    let start = Instant::now();
    let safe = repo.thread_safe();
    let history = file_history(&git, dir, &safe, &[head], false, path.into(), &cancel).await?;
    println!(
        "history: {} commits, {} names, stopped {:?}, in {:?}",
        history.entries.len(),
        history.paths.len(),
        history.stopped,
        start.elapsed()
    );
    for name in &history.paths[1..] {
        println!("  was {name}");
    }
    let start = Instant::now();
    let blamed = blame(&git, dir, head, path.into(), &cancel).await?;
    let lines: u32 = blamed.hunks.iter().map(|hunk| hunk.count).sum();
    println!(
        "blame: {lines} lines, {} hunks, {} commits, in {:?}",
        blamed.hunks.len(),
        blamed.commits.len(),
        start.elapsed()
    );
    Ok(())
}
