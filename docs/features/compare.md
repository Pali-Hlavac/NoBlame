# Compare tab

The **compare tab** shows the files that differ between two revisions (branches, tags or
commits) and the diff of the chosen one. Status: M3 slice 9 (2026-11-02), ADR
[0023](../adr/0023-compare-revisions.md).

## Behaviour

- **Opening it:**
  - in the graph, a commit's menu: **Compare with HEAD** (from the commit to HEAD; disabled on
    HEAD itself);
  - a branch's, remote branch's or tag's submenu: **Compare with the current branch** (from
    HEAD to that reference);
  - **Ctrl+click** (Cmd+click on macOS) another commit in the graph. The selection stays, and the
    commit further down the graph (usually the older one) becomes the first side;
  - the command palette: **Compare branches or commits…** (opens the tab as it was last, or
    asks for both sides).
- There is one compare tab. It opens with the diff and file tabs, beside the graph, so
  Ctrl+click can compare other commits while it is visible.
- **The two sides** are buttons that open a picker:
  - HEAD, the branches, remote branches and tags (filtered as you type);
  - or **Use "…"** for any revision typed in: a commit id, `HEAD~3`, `main@{1}`, `v1.0^`.
  - References are stored by their full name (`refs/heads/main`), so a branch and a tag with
    the same name stay apart. A reference that moves (a commit, a fetch) is compared where it is
    now: the comparison is read again when the graph reloads.
- The **swap** button exchanges the two sides.
- **Only changes since they split** compares the merge base with the second side (as
  `git diff A...B`): what the second side changed since the two diverged, without the first
  side's own later changes. Two commits without a common history say so.
- The line under the sides tells:
  - how many files differ (at most 100,000 are listed);
  - how many commits only each side has (`git rev-list --left-right --count`);
  - in merge base mode, the commit where they split.
- **Files:** the list of Changed files (status letter, name, folder or old name), sorted by
  path, beside the chosen file's diff. The diff has the diff tab's options (layout, whitespace,
  context, images, binaries). The chosen file stays when the sides change, if it differs there
  too. The divider between the list and the diff can be dragged.
- While a new comparison is read, the last one stays under a light overlay.
- Revisions that name nothing (`no-such-branch`) show git's error with a hint. Typed text never
  reaches a command line: it is resolved in-process.
- **Partial clones:** renames are found only between identical files, and a note says that an
  edited, moved file appears as deleted and added. Nothing is downloaded.

## How it works

- `git_core::compare` (ADR 0023):
  - `compare_commits` runs `git diff --raw -z --no-abbrev --no-ext-diff <from> <to>`, read-only
    with `GIT_NO_LAZY_FETCH=1`, and parses it in `compare/raw.rs`. In a partial clone it uses
    gix's tree diff (`diff::tree_changes`), with exact renames only when contents are missing.
  - `merge_base` uses gix and the commit-graph file.
  - `count_ahead_behind` runs `git rev-list --left-right --count`.
- `get_comparison(id, { base, target, sinceMergeBase })` resolves both sides with
  `graph::resolve_commit`, compares them and returns both commits (and the merge base), the files
  as `ChangedFileDto` with blob ids, the total, and whether renames were exact only. A newer
  comparison cancels one still running.
- `count_ahead_behind(id, base, target)` takes the commit ids the comparison returned.
- **Frontend:** `src/features/compare/`.
  - What is compared lives in `features/selection` (`compare`, `useComparison`), so the graph
    can set it without importing the compare feature. The chosen file is in the compare store.
  - The file list reuses `ChangedFileRow`; the diff is `FileDiffView` from the diff feature.
  - Queries are under the graph's keys, keyed by the revision text, so a reload compares again.
  - A comparison cancelled by a newer one is read again when it is shown again.

## Performance

`compare_spike` (release, 2026-11-02):

| Repository       | Revisions         | Files   | Directly | Since the merge base | Ahead/behind |
| ---------------- | ----------------- | ------- | -------- | -------------------- | ------------ |
| git.git          | v2.40.0 → v2.50.0 | 3,197   | 0.21 s   | 0.21 s               | 0.03 s       |
| git.git          | v1.0.0 → HEAD     | 5,131   | 0.04 s   | 0.07 s               | 0.06 s       |
| Linux (blobless) | v7.2 → v7.3       | 14,901  | 0.23 s   | 0.19 s               | 0.08 s       |
| Linux (blobless) | v4.0 → HEAD       | 116,665 | 0.24 s   | 0.83 s               | 0.73 s       |

gix's own rename detection took 4.0 s for the first row (ADR 0023).

## Not yet

- Comparing with the working tree (M4, with uncommitted changes); the menu entry names M4.
- Marking the compared commits in the graph.
- A history-tab entry to compare two versions of one file, and a filter for a folder.
- Several compare tabs at once.
