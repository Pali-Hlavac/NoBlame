# Commit graph

How NoBlame turns a repository's history into the graph on screen. Status: **implemented in M2**
(engine, IPC, canvas view). Not yet: the on-disk cache (ADR 0010), the file watcher, artificial
working-tree rows and stash labels. Decisions: [ADR 0008](../adr/0008-binary-graph-blocks.md)
(binary blocks), [ADR 0009](../adr/0009-canvas-graph-and-lane-layout.md) (canvas and lanes).
Feature behaviour: [features/commit-graph.md](../features/commit-graph.md).

## Pipeline

```
refs (tips) → CommitIndex → date order → lane layout (checkpoints)
                                              │
                    get_graph_block(256 rows) ┤  binary, replayed from a checkpoint
                    get_commit_rows(100 rows) ┘  JSON, read lazily from objects
                                              ▼
                         BlockCache (typed arrays) + text pages → canvas + visible DOM rows
```

All of it lives in `crates/git-core/src/graph/` (no Tauri); `Graph::build` runs on a blocking
thread, once per repository session, and the result is kept until the tab closes.

## 1. Tips: references

`collect_refs` (`refs.rs`) reads every local branch (`refs/heads/*`), remote-tracking branch
(`refs/remotes/*`) and tag (`refs/tags/*`), peeling annotated tags to their commit. Symbolic
remote refs such as `origin/HEAD` are skipped, and so are other namespaces (`refs/stash`, notes,
replace). A detached HEAD gets its own `HEAD` label; otherwise the branch HEAD points to is
marked `is_head`. A ref that cannot be resolved is logged and skipped. HEAD's commit is always a
tip, so a detached HEAD without any ref still shows.

## 2. Commit index

`CommitIndex::build` (`index/mod.rs`) walks breadth-first from the tips and gives each commit a
dense `u32` index in discovery order. Per commit it stores the object id, the committer time and
its parents. Parents use a CSR layout: one offsets array and one flat array of parent indices.
That is about 40 bytes per commit.

- **Commit-graph first.** When `objects/info/commit-graph` (or a chain) exists, parents and times
  come from it by position, without decompressing any object. A `Vec<u32>` maps graph positions to
  indices, so no hash map is needed for covered commits.
- **Object database fallback.** Commits newer than the commit-graph file (or all commits, when
  there is none) are read with `find_commit`; only these go through a small hash map.
- **Shallow clones.** Commits listed in `.git/shallow` get no parents, so history ends at the
  boundary.
- **Missing objects** (partial clones, corruption) drop the parent edge and are counted
  (`missing_parents`, shown in `GraphSummary`) instead of failing the graph.
- Tips that are not commits (tags on trees or blobs) are ignored.

## 3. Row order

`date_order` (`order.rs`) is Kahn's algorithm with a max-heap on committer time: newest first, but
a commit never appears before any of its children, even with clock skew. Ties go to the commit
found first from the tips. This is the order of `git log --all --date-order`;
`tests/graph_build.rs` checks that every row matches git's output, with and without a commit-graph
file.

## 4. Lane layout

`layout.rs` assigns each row a lane (column) and the lines coming in from the row above:

- A lane **waits for a commit** (the parent of the commit drawn above it).
- When a commit's row is reached, every lane waiting for it **converges** into its node; the
  node takes the leftmost of those lanes. A commit nobody waits for (a branch tip) takes the first
  free lane.
- The node's lane then waits for its **first parent**. Every further parent (a merge) either
  **joins** a lane that already waits for it or gets the **first free lane**. Octopus merges open
  one lane per extra parent.
- Freed lanes are reused; trailing empty lanes are dropped.
- **Colours** are assigned when a lane starts and never change, so a branch keeps its colour for
  its whole length. The UI cycles its 8-colour palette by colour id.
- Edges per row are ordered: straight lines first, then the lines leaving a merge.

Storing every row's edges would cost hundreds of megabytes for a million rows, so the full pass
keeps a **checkpoint of the lane state every 256 rows** (about 5 MB for 1M commits) and the widest
lane count. A block is **replayed** from its checkpoint on request (0.1–0.2 ms for 256 rows) and
produces exactly the same rows as the full pass.

## 5. Transport

- **Geometry**: `get_graph_block` returns one block as raw bytes (format in
  [ipc.md](ipc.md#binary-graph-blocks)): per row the node lane, its colour, flags (merge, HEAD)
  and the incoming edges.
- **Text**: `get_commit_rows` returns id, summary, author, author time, parent count and ref
  labels for up to 500 rows; the UI asks for pages of 100. Commit objects are only decoded for
  rows near the screen. Messages that are not UTF-8 are decoded lossily for display.

## 6. Frontend (`src/features/graph`)

- **BlockCache** (`lib/blockCache.ts`): an LRU of 96 decoded blocks per repository, outside React
  state. Each block is decoded into typed arrays (`lanes`, `colors`, `flags`, `edgeStart`,
  `edges`). A version counter in React state changes when a block arrives, to trigger a redraw.
  Failed blocks are reported once (toast) and not retried until the cache is cleared.
- **Viewport** (`lib/viewport.ts`): a scrollable spacer provides the scrollbar; a sticky layer as
  tall as the viewport holds the canvas and the visible text rows. Browsers cap element heights
  (Chromium at about 33.5M px, Firefox at about 17.9M px), so above 10M px the scroll position is
  scaled onto the rows. The last row of a million stays reachable, at the cost of faster wheel
  scrolling.
- **Canvas** (`lib/draw.ts`, `components/GraphCanvas.tsx`): HiDPI-scaled, redrawn for the visible
  rows only. Lines are batched per colour (one `stroke` each); a line that changes lane is a Bézier
  curve. Nodes are drawn on top: HEAD gets a ring, merges are hollow. The renderer reports which
  blocks it lacked; the view requests them plus one block of margin above and below.
- **Text rows** (`components/GraphRows.tsx`): DOM elements only for the visible rows, positioned
  over the canvas, with ref badges, summary, author, date and short id. Pages of 100 rows come
  from TanStack Query (one page of margin each side, dropped a minute after leaving the screen).
- **State**: selection and scroll position are kept per repository path in a Zustand store, so
  switching tabs keeps them.

## Performance

Measured on Windows 11 with the synthetic repositories (details and method in
[development/performance.md](../development/performance.md)):

- 1M commits: `Graph::build` takes about **560 ms** in a release build (criterion), of which the
  history itself (index, order, layout) is about 330 ms.
- First screen (open, build, first block, 60 rows of text) in the spike: **624 ms** with packed
  refs, under the 1 s target.
- Reading and peeling ~10,500 refs dominates: 242 ms when packed, **1.4 s as loose files**.
  Peeling with the packed-refs buffer is the next optimisation.

## Not yet

- On-disk cache and incremental update after fetches and commits (ADR 0010).
- File watcher refreshing refs.
- Artificial rows for working tree and index changes.
- Stash labels (`refs/stash` is not a tip yet).
