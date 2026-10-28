# 0010: Reuse the commit index between builds, and cache it on disk

- Status: Accepted
- Date: 2026-10-28
- Milestone: M2

## Context and problem

Building the graph has four phases: reading refs, indexing the history (every reachable commit
with its time and parents), ordering the rows, and laying out the lanes. Measured in release
builds on Windows:

| Phase  | synthetic-1m (commit-graph file) | synthetic-100k with commit-graph | synthetic-100k without |
| ------ | -------------------------------- | -------------------------------- | ---------------------- |
| refs   | 230 ms                           | 82 ms                            | 81 ms                  |
| index  | 104–263 ms                       | 8–20 ms                          | **368–510 ms**         |
| order  | 39 ms                            | 3 ms                             | 3 ms                   |
| layout | 198 ms                           | 9 ms                             | 9 ms                   |

Without a commit-graph file, indexing reads and decompresses every commit object: about half a
second per 100,000 commits, so several seconds for the Linux kernel. Many repositories have no
commit-graph file, or one that is old (git writes it on `gc`, not on fetch). Since M2's file
watcher, the graph is also rebuilt after every commit, checkout or fetch made outside the app,
so that cost is paid again and again, not only on opening.

The question: what do we keep between builds, and where?

## Decision drivers

- Opening and refreshing giant repositories fast, with or without a commit-graph file.
- Exactly the same graph as a full build: same rows, same order, same lanes.
- A cache must never make the graph wrong: damaged, foreign or outdated data is detected and
  ignored.
- Little code and little disk space; easy to delete.

## Considered options

1. Rebuild from scratch every time (status quo).
2. Keep the commit index (ids, times, parents) between builds, in memory for reloads and on disk
   for reopening; recompute order and layout each time.
3. Option 2 plus the row order and the layout checkpoints, valid while the tips are unchanged.
4. Write a commit-graph file ourselves (`git commit-graph write`) instead of caching.

## Decision outcome

Chosen option: **2, keep the commit index**. It removes the only phase that grows with object
reads, and keeps order and layout as they are: those two are fast (0.24 s for a million commits)
and depend on every tip, so caching them would need invalidation logic for little gain.

How it works:

- `CommitIndex::build_from(repo, tips, base)` (`crates/git-core/src/graph/index/builder.rs`)
  walks from the tips as before. A commit that `base` knows is copied from it with its time and
  parents, and the copy continues through `base` only. So only new commits are read from the
  repository, and commits the tips no longer reach (a deleted branch, rewritten history) are
  not copied. The result is the same as a full build; an integration test compares both, block
  by block (`tests/graph_incremental.rs`).
- Looking commits up in `base` uses its ids sorted once (`CommitIndex::lookup`, 4 bytes per
  commit; about 0.1 s for a million, done in the background after each build).
- **In memory**: a reload after a change (`reload_graph`) uses the previous build as `base`.
- **On disk**: after each build the index is saved to
  `<app cache dir>/graph-cache/<FNV-1a hash of the common .git folder>.nbci`
  (`src-tauri/src/repository/graph_cache.rs`), written to a temporary file and renamed. The
  first build of a session uses it as `base`. The format (`index/file.rs`, version 1) is a
  header plus the raw arrays; reading checks every length and index and that the sorted ids
  are strictly increasing. Any failure deletes the file and builds from the repository.
- **Not reused**: shallow clones (deepening gives known commits new parents) and indexes that
  lost parents to missing objects (a partial clone may fetch them later). Only SHA-1
  repositories are cached.
- Files not written for 30 days are deleted at start-up.

### Consequences

Good:

- Indexing a million commits on reload: 30 ms instead of 263 ms with a commit-graph file. Without
  one, 100,000 commits take 3.8 ms instead of 368 ms (plus 3.2 ms to decode the file).
- Repositories without a commit-graph file open as fast as those with one, from the second time
  on.
- The graph is identical to a full build, and the cache can be deleted at any time.

Bad:

- About 40 bytes per commit on disk (38.5 MB for a million commits), rewritten after every
  build, in the background.
- Replace refs (`git replace`) and grafts are not taken into account. The graph ignored them
  before too.
- Refs reading (230 ms for 10,570 refs) and layout still run on every build. After the fast
  layout pass (slice 10: 198 → 67 ms for synthetic-1m, 1.5 s → 150 ms for Linux) a reload of
  synthetic-1m takes about 330 ms and of Linux 265 ms. Reading refs through the packed-refs
  buffer is the next step if that matters.

## Pros and cons of the options

### 1. Rebuild every time

- Good: nothing to invalidate.
- Bad: seconds per refresh on large repositories without a commit-graph file, after every
  outside change.

### 2. Reuse the commit index

- Good: removes the object reads; small, verifiable file; the result equals a full build.
- Bad: order and layout are recomputed (about 0.24 s per million commits).

### 3. Also cache order and layout

- Good: an unchanged reopen could skip 0.24 s more.
- Bad: layout checkpoints are larger and change whenever any tip moves; a second invalidation
  scheme for a gain the targets do not need yet.

### 4. Write commit-graph files

- Good: git itself benefits too.
- Bad: changes the user's repository (and takes long on huge ones), which NoBlame only does
  when asked (the commit-graph offer).

## Links

- [ADR 0008](0008-binary-graph-blocks.md): blocks re-laid out from checkpoints.
- [architecture/commit-graph.md](../architecture/commit-graph.md),
  [development/performance.md](../development/performance.md).
