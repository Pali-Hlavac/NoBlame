# Performance

Performance on giant repositories is the number-one technical requirement. Measure, don't guess:
every feature that touches history, status or diffs is checked on a large repository, and the
numbers are recorded here.

## Targets

The current targets are in the [roadmap](../roadmap.md#performance-targets-first-guesses-to-be-measured-and-revised-in-m2)
(first open of a 1.3M-commit graph under 1 s, 60 fps scrolling, under 200 bytes per commit).
M2 measures them and revises them.

## Test repositories

### Synthetic (deterministic)

Built by `pnpm repos:generate` into `.cache/repos/` ([testing.md](testing.md)). Same preset,
same commit ids, on every machine.

### Real (opt-in)

Real repositories are cloned by hand into `.cache/repos/` (git-ignored) and never committed:

| Repository                                     | Why                                                     |
| ---------------------------------------------- | ------------------------------------------------------- |
| `torvalds/linux` (~1.3M commits)               | Reference for the roadmap targets; deep merge structure |
| `chromium/chromium` (~1.5M commits, huge tree) | Very large working tree and ref count                   |
| `llvm/llvm-project` (~550k commits)            | Large monorepo, mostly linear                           |

Benchmarks that use them are opt-in and skip when the folder is missing (from M2).

## Benchmarks

`pnpm bench` runs `cargo bench --workspace`. `crates/git-core/benches/graph.rs` (criterion)
measures `Graph::build` and encoding one block on a tiny repository generated on the fly, and on
`synthetic-100k` and `synthetic-1m` when they exist in `.cache/repos/`.

For a phase breakdown on any repository, including real ones:

```sh
cargo run --release -p git-core --example graph_spike -- .cache/repos/synthetic-1m
```

## Recorded numbers

### Synthetic repository generation (2026-10-27, regenerated with packed refs and ~8 min gaps)

Machine: Windows 11 Pro, git 2.56.0, release build of `noblame-repo-gen`. The 1M run shared the
machine with cargo builds and the dev app, so treat it as an upper bound.

| Preset | Commits   | Merges (octopus) | Branches | Tags | Refs total | Generate | commit-graph write | Size on disk |
| ------ | --------- | ---------------- | -------- | ---- | ---------- | -------- | ------------------ | ------------ |
| 10k    | 10,000    | 749 (17)         | 209      | 53   | ~470       | 3.5 s    | 0.32 s             | 13 MB        |
| 100k   | 100,000   | 7,940 (175)      | 2,025    | 89   | ~4,140     | 39.9 s   | 3.9 s              | 118 MB       |
| 1m     | 1,000,000 | 79,765 (1,619)   | 5,065    | 449  | 10,570     | 620.3 s  | 69.7 s             | 1.2 GB       |

"Branches" counts `refs/heads/*`; every branch also has an `origin/*` remote-tracking ref.
Generation time is dominated by `git fast-import`. The repositories are not repacked afterwards
(`git gc` would shrink them; benchmarks may want both variants).

### Commit graph (M2, 2026-10-27)

Machine: Windows 11 Pro, git 2.56.0, release builds, repositories with a commit-graph file.
Measured on the repositories generated before the commit-gap change (same shape, different
dates); regenerated repositories are re-checked below.

`graph_spike`, phases of `Graph::build` plus the first screen (block 0 and 60 rows of text):

| Repository     | Refs   | Refs, loose | Refs, packed | Index  | Order  | Layout | First screen (packed refs) |
| -------------- | ------ | ----------- | ------------ | ------ | ------ | ------ | -------------------------- |
| synthetic-10k  | ~470   | 112 ms      | not measured | 2.1 ms | 0.2 ms | 0.3 ms | 152 ms (loose refs)        |
| synthetic-100k | ~4,140 | 814 ms      | 85 ms        | 21 ms  | 2.9 ms | 7.3 ms | 139 ms                     |
| synthetic-1m   | 10,570 | 1.4 s       | 242 ms       | 104 ms | 36 ms  | 190 ms | 624 ms                     |

Findings:

- History is cheap with the commit-graph file: a million commits are indexed, ordered and laid
  out in about 330 ms.
- References dominate. One file per ref (as `fast-import` leaves them) costs 1.4 s for 10k refs
  on Windows; `packed-refs` (what clones have) costs 242 ms. Next optimisation: peel through the
  packed-refs buffer and its peeled entries.
- Replaying one 256-row block from its checkpoint takes 0.03 ms (10k) to 0.17 ms (1M, 65
  lanes); a block of the 1M graph is about 100 KB.
- Memory: index, order and checkpoints come to roughly 50 bytes per commit, estimated from the
  data structures (not measured), under the 200 bytes per commit target.

Criterion (`pnpm bench`, median):

| Benchmark                         | Time     |
| --------------------------------- | -------- |
| graph/tiny/build (200 commits)    | 0.83 ms  |
| graph/tiny/encode_block           | 13 µs    |
| graph/synthetic-100k/build        | 95.6 ms  |
| graph/synthetic-100k/encode_block | 67 µs    |
| graph/synthetic-1m/build          | 557.5 ms |

In the running dev app (debug build; git-core at opt-level 3, dependencies at opt-level 2) the
1M graph built in about 1.5 s, refs taking 0.6–0.9 s of it.

After regenerating the repositories (packed refs, new dates), `graph_spike` gives the same picture:
first screen 43 ms (10k, refs 9.5 ms), 146 ms (100k) and 657 ms (1M; refs 260 ms, index 113 ms,
order 42 ms, layout 196 ms).

### Commit details and "contained in" (M2.5, 2026-10-28)

`commit_details` for the oldest commit of synthetic-1m (the worst case: every row lies above it)
takes **5.5 ms**, and that commit is contained in 10,570 refs. The containment pass walks the rows
from the commit's row up to row 0 and checks each parent row, using the graph's topological order.
Measured with `graph_spike` (release build), while the dev app was running, so the same run
showed refs at 828 ms instead of the usual 260 ms.

### Highlighted history (2026-10-28)

`graph_spike` on synthetic-1m (release build, dev app running): selecting the newest commit (the
worst case: a million ancestors) finds its history in **3.5 ms**; its first overlay block is ready
0.1 ms later. Jumping straight to the last block replays the layout once below the commit:
**245 ms**, paid once per selection (block states are kept). Before skipping the row output for
blocks that are only passed through, that jump took 644 ms.

Not measured yet: frame times while scrolling, a real large repository (Linux kernel), a cold
disk cache, macOS and Linux.
