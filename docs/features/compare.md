# Compare tab

The **compare tab** shows the files that differ between two revisions (branches, tags or
commits), or between a revision and the working tree, and the diff of the chosen one. Status: M3
slice 9 (2026-11-02), ADR [0023](../adr/0023-compare-revisions.md); the working tree in M4 slice 6
(2026-11-04).

## Behaviour

- **Opening it:**
  - in the graph, a commit's menu: **Compare with HEAD** (from the commit to HEAD; disabled on
    HEAD itself) and **Compare with the working tree** (from the commit to the files on disk; not
    in bare repositories);
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
  - or **Use "…"** for any revision typed in: a commit id, `HEAD~3`, `main@{1}`, `v1.0^`;
  - on the second side only, **Working tree (your files now)**.
  - References are stored by their full name (`refs/heads/main`), so a branch and a tag with
    the same name stay apart. A reference that moves (a commit, a fetch) is compared where it is
    now: the comparison is read again when the graph reloads.
- The **swap** button exchanges the two sides. It is disabled while the second side is the
  working tree, which can only be the second side.
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

### The working tree

- The list is what `git diff <revision>` lists: tracked files changed on disk or in the index,
  and files added to the index. Untracked files are not listed (as in git).
- The diff of a file compares the revision's version with the file on disk as git would store it
  (line endings and filters applied), so it is the same as the Diff tab's working tree diffs. A
  deleted file shows the revision's version; a submodule shows the commits it points to.
- **Only changes since they split** starts from the merge base of the revision and HEAD.
- The line below counts the commits of HEAD (the commit the working tree is on), and the right
  button's tooltip names it.
- The comparison is read again whenever the files or the refs change (the file watcher, a commit,
  a stash), like the status.

## How it works

- `git_core::compare` (ADR 0023):
  - `compare_commits` runs `git diff --raw -z --no-abbrev --no-ext-diff <from> <to>`, read-only
    with `GIT_NO_LAZY_FETCH=1`, and parses it in `compare/raw.rs`. In a partial clone it uses
    gix's tree diff (`diff::tree_changes`), with exact renames only when contents are missing.
  - `compare_with_worktree` (`compare/worktree.rs`) runs `git diff --raw -z --no-abbrev
--no-ext-diff <from> --` in the working tree, read-only. In a partial clone it adds `-M100%`
    (exact renames only), so git never reads old contents that may be missing. Each file's new
    id is cleared (submodules aside): git gives the index's id, none, or the hash of contents
    it never stored (when it looked for renames), so the file on disk is read instead.
  - `merge_base` uses gix and the commit-graph file.
  - `count_ahead_behind` runs `git rev-list --left-right --count`.
- `get_comparison(id, { base, target, sinceMergeBase, worktree })` resolves both sides with
  `graph::resolve_commit`, compares them and returns both commits (and the merge base), the files
  as `ChangedFileDto` with blob ids, the total, whether renames were exact only, and `worktree`.
  With `worktree`, `target` is ignored and HEAD stands for the working tree's commit. A newer
  comparison cancels one still running.
- `count_ahead_behind(id, base, target)` takes the commit ids the comparison returned.
- **Frontend:** `src/features/compare/`.
  - What is compared lives in `features/selection` (`compare`, `useComparison`), so the graph
    can set it without importing the compare feature. The working tree is the target
    `WORKING_TREE` (`"(working tree)"`, which no revision can be: references contain no spaces).
    The chosen file is in the compare store.
  - The file list reuses `ChangedFileRow`; the diff is `FileDiffView` from the diff feature.
  - Queries are under the graph's keys, keyed by the revision text, so a reload compares again.
    A comparison with the working tree is under the status keys, so every change to the files or
    refs compares again; its diffs use the diff feature's `DiskFileDiff`.
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

With the working tree (a shared clone of git.git with 4,857 files checked out, git 2.56,
Windows): `v2.40.0` → working tree 0.49 s (3,846 files, renames found), `v1.0.0` → working tree
0.13 s (5,131 files; git skips exhaustive renames above `diff.renameLimit`).

## Not yet

- The working tree as the first side (a reversed diff).
- Untracked files in a comparison with the working tree.
- Marking the compared commits in the graph.
- A history-tab entry to compare two versions of one file, and a filter for a folder.
- Several compare tabs at once.
