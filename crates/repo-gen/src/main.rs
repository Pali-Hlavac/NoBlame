//! `noblame-repo-gen`: builds synthetic repositories into `.cache/repos/` (see
//! `docs/development/performance.md`). Run it through `pnpm repos:generate`.

// A command-line tool reports progress on stdout by design.
#![allow(clippy::print_stdout)]

use std::path::{Path, PathBuf};
use std::process::ExitCode;
use std::time::Instant;

use clap::Parser;
use noblame_repo_gen::{GenError, Preset, Spec, generate, write_commit_graph};

/// Prefix every generated directory starts with; `--force` only deletes such directories.
const GENERATED_DIR_PREFIX: &str = "synthetic-";

/// Generate deterministic synthetic Git repositories for tests and benchmarks.
#[derive(Debug, Parser)]
#[command(version)]
struct Args {
    /// Sizes to generate.
    #[arg(long, value_enum, num_args = 1.., default_values = ["10k", "100k"])]
    preset: Vec<Preset>,
    /// Generate a custom number of commits instead of presets (shape of the 100k preset).
    #[arg(long, conflicts_with = "preset")]
    commits: Option<u32>,
    /// Folder that receives one sub-folder per repository.
    #[arg(long, default_value = ".cache/repos")]
    out: PathBuf,
    /// Delete and regenerate repositories that already exist.
    #[arg(long)]
    force: bool,
    /// Skip writing the commit-graph file.
    #[arg(long)]
    no_commit_graph: bool,
}

fn main() -> ExitCode {
    let args = Args::parse();
    let jobs: Vec<(String, Spec)> = match args.commits {
        Some(commits) => vec![(
            format!("{GENERATED_DIR_PREFIX}custom-{commits}"),
            Spec {
                commits,
                ..Preset::Medium.spec()
            },
        )],
        None => args
            .preset
            .iter()
            .map(|preset| (preset.dir_name().to_owned(), preset.spec()))
            .collect(),
    };
    for (name, spec) in jobs {
        if let Err(error) = build(&args, &args.out.join(&name), &spec) {
            eprintln!("error: {name}: {error}");
            return ExitCode::FAILURE;
        }
    }
    ExitCode::SUCCESS
}

fn build(args: &Args, dir: &Path, spec: &Spec) -> Result<(), GenError> {
    if dir.exists() {
        if !args.force {
            println!(
                "{}: exists, skipped (use --force to rebuild)",
                dir.display()
            );
            return Ok(());
        }
        let is_generated = dir
            .file_name()
            .is_some_and(|name| name.to_string_lossy().starts_with(GENERATED_DIR_PREFIX));
        if !is_generated {
            return Err(GenError::NotEmpty(dir.to_path_buf()));
        }
        std::fs::remove_dir_all(dir)?;
    }
    println!("{}: generating {} commits…", dir.display(), spec.commits);
    let started = Instant::now();
    let summary = generate(spec, dir)?;
    let generated_in = started.elapsed();
    if !args.no_commit_graph {
        write_commit_graph(dir)?;
    }
    println!(
        "{}: {} commits ({} merges, {} octopus), {} branches, {} tags in {:.1?} (+{:.1?} commit-graph)",
        dir.display(),
        summary.commits,
        summary.merges,
        summary.octopus_merges,
        summary.branches,
        summary.tags,
        generated_in,
        started.elapsed().saturating_sub(generated_in),
    );
    Ok(())
}
