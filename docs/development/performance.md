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

### Linux kernel (M2 slice 10, 2026-10-28)

`torvalds/linux` cloned with `--filter=blob:none --no-checkout` into `.cache/repos/linux` (2.1 GB,
1,503,174 commits, 957 refs, up to **702 lanes** at once). `graph_spike`, release build:

| Phase                     | No commit-graph file | With commit-graph file |
| ------------------------- | -------------------- | ---------------------- |
| refs                      | 25 ms                | 24 ms                  |
| index                     | 9.3–12.9 s           | 203 ms                 |
| order                     | 64 ms                | 63 ms                  |
| layout, before / after    | 1.5 s / 150 ms       | 157 ms                 |
| first screen              | 10.9 s               | **482 ms**             |
| rebuild reusing the index | 265 ms               | 265 ms                 |

- The commit-graph file took 11 s to write.
- From the second open, the index comes from the cache: 39–44 ms to read and validate the 58 MB
  file plus 35 ms to index, so a warm reopen is about 25 + 40 + 35 + 63 + 157 ≈ 320 ms.
- Layout was 1.5 s because each row scanned all 702 lanes. The full pass now finds lanes
  through a map and builds the outgoing lines only at checkpoints (`layout/fast.rs`):
  150 ms, identical checkpoints (tested on random wide histories). synthetic-1m: 198 → 67 ms.
- Memory (index, order, layout checkpoints): 88 bytes per commit (129 MB); synthetic-1m 56.
- A block of 256 rows is 470 KB here (about 300 lines per row) and replays in 0.5 ms. The
  canvas only draws 16 lanes, so the encoder could drop lines beyond them; not done yet.
- Highlighting the newest commit's history: 5.8 ms; jumping to the last block 1.5 s (the lit
  replay still uses the row-by-row step).

### Reusing the commit index (ADR 0010, 2026-10-28)

`graph_spike`, release build, while the owner's dev app was running:

| Repository                  | Index, full build | Index, reusing | Sort ids (once per build) | Cache file | Decode + validate |
| --------------------------- | ----------------- | -------------- | ------------------------- | ---------- | ----------------- |
| synthetic-100k              | 7.9 ms            | 4.4 ms         | 9.5 ms                    | 3.8 MB     | 3.1 ms            |
| synthetic-100k, no c-g file | 368 ms            | 3.8 ms         | 9.8 ms                    | 3.8 MB     | 3.2 ms            |
| synthetic-1m                | 263 ms            | 29.9 ms        | 127.6 ms                  | 38.5 MB    | 28.6 ms           |

A whole rebuild of synthetic-1m reusing the index took 458 ms (refs and layout dominate).

### Working tree status (2026-10-28)

`git --no-optional-locks status --porcelain=v2 -z`, warm, clean trees (Windows 11, git 2.56.0):
synthetic-10k (2,000 files) 106 ms including the first run, synthetic-100k (10,000 files)
125 ms, synthetic-1m (40,000 files) about 170 ms warm (716 ms cold). With `core.fsmonitor`
and the untracked cache on, synthetic-1m stays at about 173 ms (the tree is small enough that
the scan is not the cost). A 100k+ file tree is still to be measured.

### File diffs (M3, ADR 0013, 2026-10-28)

`cargo run --release -p git-core --example diff_spike -- <repo> <old-blob> <new-blob>`, Windows 11,
warm. Synthetic files written with `git hash-object -w`:

| Case                                                      | Rows    | Diff  | Page of 500 rows | Memory |
| --------------------------------------------------------- | ------- | ----- | ---------------- | ------ |
| 13 MB, 200,000 lines, 2,000 scattered edits (1,857 hunks) | 16,268  | 46 ms | 0.06 ms          | 31 MB  |
| two unrelated 300,000-line files (9 MB each, one hunk)    | 600,001 | 56 ms | 0.03 ms          | 48 MB  |

"Diff" covers reading both blobs, comparing and building the rows. `git diff --stat` on the
first pair takes about 117 ms. The Linux benchmark clone is blobless, so its old file contents
are not local; the diff tab says so instead of downloading them.

With side-by-side rows built as well (slice 3a, 2026-10-29): 40–50 ms and 31 MB for the first
case, 70 ms and 56 MB for the second.

Syntax highlighting (slice 3c), 3.7 MB Rust file, 58,000 lines, 549 hunks (4,862 rows), release:

| Approach                                     | Last page, cold | Page, warm |
| -------------------------------------------- | --------------- | ---------- |
| fancy-regex, every line between hunks parsed | 11.9 s          | 1.37 s     |
| Oniguruma, every line between hunks parsed   | 3.8 s           | 449 ms     |
| Oniguruma, only shown lines parsed           | 258 ms          | 37 ms      |
| **fancy-regex, only shown lines (shipped)**  | **866 ms**      | **123 ms** |

Oniguruma's parser state is not `Send`, so the session could not cache it (ADR 0013).

With the grammars of two-face (bat's, 2026-10-30) the same file takes 874 ms cold and 121 ms per
warm page, unchanged.

Not measured yet: frame times while scrolling, a real large repository (Linux kernel), a cold
disk cache, macOS and Linux.

### Graph filters (M3 slice 4a, ADR 0021, 2026-10-29)

Measured with `graph_spike` (release), from the loaded full graph. The view's time is choosing
the commits plus building the view, which is mostly the new lane layout.

| Repository   | Filter             | Shown rows | Lanes | Total  | Choose commits |
| ------------ | ------------------ | ---------- | ----- | ------ | -------------- |
| synthetic-1m | no merges          | 920,235    | 96    | 137 ms | 1.5 ms         |
| synthetic-1m | first parent       | 482,289    | 65    | 63 ms  | 9.1 ms         |
| synthetic-1m | HEAD               | 999,669    | 65    | 103 ms | 4.0 ms         |
| synthetic-1m | HEAD, first parent | 447,846    | 1     | 60 ms  | 8.0 ms         |
| linux (1.5M) | no merges          | 1,389,739  | 863   | 229 ms | 1.8 ms         |
| linux        | first parent       | 79,113     | 4     | 28 ms  | 3.7 ms         |
| linux        | HEAD               | 1,503,134  | 702   | 219 ms | 6.7 ms         |
| linux        | HEAD, first parent | 77,524     | 1     | 28 ms  | 3.2 ms         |

The synthetic-1m run shared the machine with the owner's dev app. Hiding merges widens the
graph (96 and 863 lanes), because a hidden merge joins its child to both of its sides.

Text filters (slice 4b), the same way. Every commit is read: 16 threads on the owner's
32-thread machine. Warm disk cache, so repeated runs differ by a few tenths of a second.

| Repository   | Filter            | Matches | Total     | `git log` with the same option |
| ------------ | ----------------- | ------- | --------- | ------------------------------ |
| synthetic-1m | author "hopper"   | 142,286 | 0.7–0.8 s | 5.7 s (`--author -i`)          |
| synthetic-1m | message "fix"     | 0       | 0.54 s    | 5.0 s (`--grep -i`)            |
| linux (1.5M) | author "torvalds" | 47,220  | 1.2–1.9 s | 13.1 s (`--author -i`)         |
| linux        | message "fix"     | 486,388 | 1.4 s     | not measured                   |

Path filter (slice 4c): the time is `git rev-list <tips> -- <path>`. Making the view adds the
times above.

| Repository   | Path          | Matches | `git rev-list`                                       |
| ------------ | ------------- | ------- | ---------------------------------------------------- |
| synthetic-1m | `src/m0080`   | 3,392   | 1.6 s (commit-graph with changed-path Bloom filters) |
| linux (1.5M) | `MAINTAINERS` | 22,019  | 6.2 s (commit-graph without Bloom filters)           |

Find bar (slice 6), first search of a query (later Next/Previous reuse it):

| Repository   | Query        | Matches | Time   |
| ------------ | ------------ | ------- | ------ |
| synthetic-1m | "hopper"     | 142,286 | 666 ms |
| synthetic-1m | "b4aae6fe"   | 1       | 385 ms |
| linux (1.5M) | "torvalds"   | 116,863 | 1.8 s  |
| linux        | "c339f4010d" | 1       | 746 ms |

Match counts of the text filters equal `git log`'s. Tried and dropped:

- 8 threads instead of 16: 30 % slower;
- an 8 MB object cache per thread: 15 % slower (commits are rarely deltas).
