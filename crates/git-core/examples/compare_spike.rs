//! Spike for M3: times comparing two revisions: resolving them, the files that differ (directly
//! and since the merge base) and the commits each one has that the other lacks.
//!
//! ```sh
//! cargo run --release -p git-core --example compare_spike -- <repository> <base> <target>
//! ```

// A measurement tool prints its results.
#![allow(clippy::print_stdout)]

use std::path::{Path, PathBuf};
use std::process::ExitCode;
use std::time::Instant;

use git_core::cli::Git;
use git_core::compare::{compare_commits, count_ahead_behind, merge_base};
use git_core::graph::resolve_commit;
use git_core::repo::Repository;
use tokio_util::sync::CancellationToken;

#[tokio::main(flavor = "current_thread")]
async fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let [repository, base, target] = args.as_slice() else {
        println!("usage: compare_spike <repository> <base> <target>");
        return ExitCode::FAILURE;
    };
    match run(&PathBuf::from(repository), base, target).await {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            println!("error: {error}");
            ExitCode::FAILURE
        }
    }
}

async fn run(dir: &Path, base: &str, target: &str) -> Result<(), Box<dyn std::error::Error>> {
    let repo = Repository::discover(dir)?;
    let local = repo.local();
    let safe = repo.thread_safe();
    let git = Git::locate()?;
    let cancel = CancellationToken::new();
    let start = Instant::now();
    let (base, target) = (
        resolve_commit(&local, base)?,
        resolve_commit(&local, target)?,
    );
    println!("resolved {base} and {target} in {:?}", start.elapsed());
    for since_merge_base in [false, true] {
        let start = Instant::now();
        let compared =
            compare_commits(&git, dir, &safe, base, target, since_merge_base, &cancel).await?;
        println!(
            "{}: {} files from {}, exact renames only {}, in {:?}",
            if since_merge_base {
                "since merge base"
            } else {
                "directly"
            },
            compared.total,
            compared.from,
            compared.exact_renames_only,
            start.elapsed()
        );
    }
    let start = Instant::now();
    let found = merge_base(&local, base, target)?;
    println!("merge base {found} in {:?}", start.elapsed());
    let start = Instant::now();
    let counts = count_ahead_behind(&git, dir, base, target, &cancel).await?;
    println!(
        "{} ahead, {} behind, in {:?}",
        counts.ahead,
        counts.behind,
        start.elapsed()
    );
    Ok(())
}
