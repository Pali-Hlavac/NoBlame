//! Spike for M4: times reading the working tree status (`git status`, every untracked file
//! listed), reading changed files as git would store them, for their diffs, and the commit
//! message box's recent messages (the worst case: an address with no commits).
//!
//! ```sh
//! cargo run --release -p git-core --example status_spike -- <repository>
//! ```

// A measurement tool prints its results.
#![allow(clippy::print_stdout)]

use std::path::{Path, PathBuf};
use std::process::ExitCode;
use std::time::Instant;

use git_core::cli::Git;
use git_core::commit::{RECENT_SCAN_LIMIT, recent_messages};
use git_core::diff::{DiffOptions, read_worktree_file, worktree_diff};
use git_core::repo::Repository;
use git_core::status::{UntrackedFiles, working_tree_status};
use tokio_util::sync::CancellationToken;

/// Status reads timed (the first one is cold).
const STATUS_RUNS: usize = 3;
/// Changed files read and diffed at most.
const FILES_READ: usize = 5;
/// Recent messages asked for, as the message box does.
const RECENT_MESSAGES: usize = 20;

#[tokio::main(flavor = "current_thread")]
async fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let [repository] = args.as_slice() else {
        println!("usage: status_spike <repository>");
        return ExitCode::FAILURE;
    };
    match run(&PathBuf::from(repository)).await {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            println!("error: {error}");
            ExitCode::FAILURE
        }
    }
}

async fn run(dir: &Path) -> Result<(), Box<dyn std::error::Error>> {
    let repo = Repository::discover(dir)?.local();
    let git = Git::locate()?;
    for email in [None, Some(&b"nobody@invalid"[..])] {
        let start = Instant::now();
        let messages = recent_messages(&repo, email, RECENT_MESSAGES)?;
        println!(
            "recent messages ({}): {} in {:?} (at most {RECENT_SCAN_LIMIT} commits)",
            if email.is_some() {
                "no match"
            } else {
                "anyone"
            },
            messages.len(),
            start.elapsed()
        );
    }
    let untracked = UntrackedFiles::configured(&repo);
    let mut status = None;
    for _ in 0..STATUS_RUNS {
        let start = Instant::now();
        let read = working_tree_status(&git, dir, untracked, &CancellationToken::new()).await?;
        println!("status ({untracked:?} untracked) in {:?}", start.elapsed());
        status = Some(read);
    }
    let Some(status) = status else { return Ok(()) };
    println!(
        "{:?}; listed {} staged, {} unstaged",
        status.summary,
        status.staged.len(),
        status.unstaged.len()
    );
    for file in status
        .unstaged
        .iter()
        .filter(|file| file.in_worktree)
        .take(FILES_READ)
    {
        let start = Instant::now();
        let Some(read) = read_worktree_file(&repo, file.path.as_ref())? else {
            continue;
        };
        let elapsed = start.elapsed();
        let size = read.size;
        let start = Instant::now();
        let diff = worktree_diff(&repo, file.old_id, read, DiffOptions::default())?;
        println!(
            "{}: {size} bytes read in {elapsed:?}, diffed in {:?} (+{} -{})",
            file.path,
            start.elapsed(),
            diff.additions(),
            diff.deletions()
        );
    }
    Ok(())
}
