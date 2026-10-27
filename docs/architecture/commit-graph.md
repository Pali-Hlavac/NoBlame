# Commit graph

Status: **design for M2, nothing implemented yet.** This page records the agreed direction from
the roadmap so M2 starts from it; it is rewritten with measured facts as M2 lands. Decisions
follow in ADR 0008 (binary stream), ADR 0009 (canvas and lane layout) and ADR 0010 (cache).

## Goals

From the roadmap's performance targets (Linux kernel, about 1.3M commits):

| Scenario                                | Target                 |
| --------------------------------------- | ---------------------- |
| First rows visible, first open          | < 1 s                  |
| First rows visible, reopening (warm)    | < 300 ms               |
| Whole history indexed in the background | < 30 s, UI responsive  |
| Scrolling                               | 60 fps, no blank rows  |
| Memory for the graph index              | < 200 bytes per commit |

## Pipeline

1. **Walk** (`git-core::graph`, `gix`): topological order from all refs, using the
   commit-graph file when present (and offering to write it with `--changed-paths` when not).
   Spike first on the 1M-commit synthetic repository and measure.
2. **Lane layout** (Rust, incremental): assigns each commit a lane and computes the edges for
   each row, with stable lane colours, merge and fork edges and octopus merges.
3. **Stream**: rows are packed into compact binary batches and sent over a Tauri `Channel`; the
   first screen goes first. The format is documented in [ipc.md](ipc.md).
4. **Store**: the frontend keeps rows in typed arrays outside React state.
5. **Render**: a virtualized `<canvas>` draws only visible rows, HiDPI-aware; text columns
   (message, author, date, hash, ref labels) are drawn on the canvas or in a thin virtualized
   layer, never as one DOM node per commit.
6. **Cache**: the walk and layout are cached on disk per repository and updated incrementally
   after fetches and commits.

## Test data

`pnpm repos:generate` builds deterministic repositories with 10k, 100k and 1M commits, merges,
octopus merges, thousands of branches and tags ([development/testing.md](../development/testing.md)).
Generation times are in [development/performance.md](../development/performance.md).
