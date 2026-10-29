# 0021: Graph filters as views of the loaded graph

- Status: Accepted
- Date: 2026-10-29
- Milestone: M3

## Context and problem

The owner asked for filters in the repository tab:

- one branch;
- one author;
- changes to a path;
- a search in messages;
- first parent only;
- no merges.

Git Extensions runs `git log` with the matching options and draws whatever comes back.

NoBlame already holds the whole history of an open tab in memory:

- the commit index;
- the row order;
- the lane checkpoints.

Everything else is keyed by row:

- the binary blocks;
- the text pages;
- the commit details;
- the highlight.

A filter must give a graph that all of these keep working with. It must also stay fast at the
sizes in [performance.md](../development/performance.md): a million synthetic commits, and the
1.5M commits and 702 lanes of the Linux kernel.

## Decision drivers

- Speed on huge histories: a filter change should be a fraction of a second, not a new `git log`
  of every commit.
- One graph per tab: rows, blocks, text, details and the highlight must agree on what a row is.
- Correct lines: a shown commit must connect to its nearest shown ancestors, as git's parent
  rewriting does, so the graph stays readable.
- git's semantics where they are subtle (history simplification for paths).

## Considered options

1. Run `git log` with the filter options and build a second graph from its output (Git
   Extensions' way).
2. Make a view of the graph already loaded: choose the shown commits in memory, rewrite parents,
   and lay the view out again.
3. Draw the full graph and dim the commits that do not match (no new rows).

## Decision outcome

Chosen option: **2, views of the loaded graph**. For paths and text, the commits are found as
described below.

The code is in `crates/git-core/src/graph/filter.rs` and `view.rs`.

### Which commits are shown

`Graph::shown_by` returns one flag per commit:

- **Branch** (`Tips`): every reference, HEAD, or chosen references.
  - Rows are topological, so one pass down the rows marks the ancestors of the tips.
  - In first-parent mode, the pass follows first parents only.
- **No merges**: commits with more than one parent are cleared.
- **Author and message** (slice 4b, planned): the commit objects still marked are read on
  several threads with gix. They are matched without case.
- **Path** (slice 4c, planned):
  - `git rev-list <tips> -- <path>` keeps git's history simplification, and its changed-path
    Bloom filters, which the commit-graph offer writes.
  - The ids it prints are intersected with the flags.

### Views

`Graph::view(shown, first_parent)` builds a `Graph` of only the shown commits:

- **Order.** Rows keep the full graph's order, which is already topological and by date, so
  nothing is sorted again.
  - In a view, commit `i` is on row `i`.
  - `full_rows` maps view rows to full rows; it is ascending, so the reverse mapping is a binary
    search.
- **Parent rewriting.** The rows are walked from the oldest up.
  - A hidden commit stands for the nearest shown commits below it, kept in a compact array.
  - A list is used only for hidden merges that lead to several shown commits, capped at 32.
  - A shown commit's parents are the union of what its real parents stand for.
- **Layout.** The lane layout runs again on the view (`Layout::compute`).
- **Real data.**
  - Merge flags and parent counts come from the full graph, so a commit is not drawn as a merge
    because a hidden merge left it with two lines.
  - Commit details read parents and "contained in" from the full graph.
  - A parent that the filter hides has no row (`ParentDto.row` is `null`).

### Sessions and IPC

The session keeps the full graph, the filter, and the shown graph (the full one when nothing is
filtered).

`set_graph_filter(id, filter, row)` returns a `ReloadedGraph` like `reload_graph`:

- the new `GraphSummary`, with its `filter` and `totalRows`;
- the row of the selected commit, if it is shown.

A reload after a change outside the app keeps the filter. Each new view bumps
`GraphSummary.generation`, so the frontend drops row-keyed caches as it does after a reload.

### Consequences

Good:

- Branch, first-parent and no-merge filters take 28–230 ms on the Linux kernel (1.5M commits),
  60–140 ms on synthetic-1m. The new lane layout is almost all of it.
- No second graph code path: blocks, text pages, the highlight and details work unchanged on a
  view.
- Memory: a view has its own index and checkpoints, about 50 bytes per shown commit. It shares
  the refs and keeps the full graph alive.

Bad:

- The order of a view is the full graph's order, not the order `git log` would choose for the
  smaller set. With clock skew, two commits can swap places compared with git. An integration
  test checks the sets against `git log` and the order where they must agree (`--no-merges`).
- Parent rewriting is the plain "nearest shown ancestor" rule. It is not git's
  `--simplify-merges`, so a side line can be drawn into a commit that is also reachable through
  the main line.
- Text filters must read commit objects, and a path filter starts a `git` process. Those cost
  more than the structural filters; they are measured in their own slices.

## Pros and cons of the options

### 1. `git log` with filter options

- Good: git's exact semantics for every option.
- Bad:
  - every change walks the history again;
  - `git log --author` on Linux reads all 1.5M commits on one thread;
  - a second graph build path is needed.
- Bad: `git log --graph`-style parent rewriting would need `--parents` output parsed and laid
  out anyway.

### 2. Views of the loaded graph (chosen)

- Good: structural filters in milliseconds; one row model for everything.
- Bad: a second index and layout per view; the order is the full graph's.

### 3. Dimming non-matching commits

- Good: no new rows or layout.
- Bad: a filter that keeps 1 commit in 10,000 still shows a million rows to scroll through. It
  is not what was asked for. Dimming already serves the highlight of the selected commit.

## Links

- [architecture/commit-graph.md](../architecture/commit-graph.md#filtered-views)
- [features/commit-graph.md](../features/commit-graph.md#filters)
- ADR [0009](0009-canvas-graph-and-lane-layout.md) (lane layout), [0010](0010-on-disk-graph-cache.md)
  (commit index)
