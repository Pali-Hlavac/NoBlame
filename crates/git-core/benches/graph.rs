//! Graph build and block encoding. The tiny repository is generated on the fly; the 100k and
//! 1M ones run only when `pnpm repos:generate --preset 100k 1m` has created them.
//!
//! ```sh
//! pnpm bench            # or: cargo bench -p git-core --bench graph
//! ```
#![allow(missing_docs, clippy::unwrap_used, clippy::expect_used)]

use std::path::{Path, PathBuf};
use std::time::Duration;

use criterion::{Criterion, criterion_group, criterion_main};
use git_core::graph::Graph;
use git_core::repo::Repository;
use noblame_repo_gen::{Preset, generate, write_commit_graph};

/// Large repositories are slow to build; fewer samples keep the run short.
const LARGE_SAMPLE_SIZE: usize = 10;
const LARGE_MEASUREMENT: Duration = Duration::from_secs(20);

fn cached_repo(name: &str) -> Option<PathBuf> {
    let path = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../.cache/repos")
        .join(name);
    path.join(".git").is_dir().then_some(path)
}

fn bench_repo(c: &mut Criterion, name: &str, path: &Path, large: bool) {
    let repo = Repository::discover(path).unwrap().local();
    let mut group = c.benchmark_group(format!("graph/{name}"));
    if large {
        group
            .sample_size(LARGE_SAMPLE_SIZE)
            .measurement_time(LARGE_MEASUREMENT);
    }
    group.bench_function("build", |b| b.iter(|| Graph::build(&repo).unwrap()));
    let graph = Graph::build(&repo).unwrap();
    let middle = graph.block_count() / 2;
    group.bench_function("encode_block", |b| b.iter(|| graph.encode_block(middle)));
    group.finish();
}

fn graph_benches(c: &mut Criterion) {
    let dir = tempfile::tempdir().unwrap();
    generate(&Preset::Tiny.spec(), dir.path()).unwrap();
    write_commit_graph(dir.path()).unwrap();
    bench_repo(c, "tiny", dir.path(), false);
    for (name, large) in [("synthetic-100k", false), ("synthetic-1m", true)] {
        match cached_repo(name) {
            Some(path) => bench_repo(c, name, &path, large),
            None => eprintln!("skipping {name}: run `pnpm repos:generate --preset 100k 1m`"),
        }
    }
}

criterion_group!(benches, graph_benches);
criterion_main!(benches);
