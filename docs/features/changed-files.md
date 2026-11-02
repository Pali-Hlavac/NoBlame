# Changed files

The **Changed files** module (Alt+5) lists the files the selected commit changed, or the files
of the selected working tree row. Status: M3 slice 1; working tree files M4 slice 1. Choosing a
file shows its diff in the diff tab ([diff.md](diff.md), slice 2).

## What it shows

- One row per file: a status letter (**A**dded, **M**odified, **D**eleted, **R**enamed,
  **C**opied, coloured with the `--status-*` tokens), the file name, and its folder. A rename
  shows the old path instead of the folder (`← old/path.rs`); a deleted file is struck through;
  a submodule pointer gets a package icon.
- Rows are sorted by path, as `git diff --name-status` lists them.
- The header counts the files. A commit that changed more than 5,000 files lists the first 5,000
  and says so.
- A merge commit is compared with its first parent; a **Compared with** menu switches to another
  parent. A root commit is compared with the empty tree (every file is added).
- With a working tree row selected, it lists that row's files (see below).

Choosing a file (click, arrows, Enter) stores its path as the repository's chosen file in
`features/selection` (`selectFile`) and shows the diff tab (`showDiffTab`). The path stays when
another commit is selected: the row with the same path is highlighted again, and the diff tab
shows that file if the new commit changed it. The compared parent is kept in the same store
(`compareWithParent`) and goes back to the first parent when the selection changes.

## Working tree files (M4 slice 1)

With **Working tree changes** selected, the list shows the changed, untracked (**?**) and
conflicted (**U**, in the destructive colour) files; with **Staged changes**, the staged ones.
The header counts all of them; each list stops at 5,000.

- One `git status --porcelain=v2 -z` run (`git_core::status::working_tree_status`, read-only)
  gives the counts for the graph rows and both lists, so they always agree. `get_status`
  returns them; `useStatusSummary` selects the counts from the same query.
- Untracked files are listed one by one (`--untracked-files=all`) unless the repository's
  `status.showUntrackedFiles` is `no` (or false): then none are, as git would.
- A staged file carries its `HEAD` blob and its index blob (`hH`, `hI`); a changed file its
  index blob, and `worktree: true` when it is still on disk; a conflict its "ours" blob
  (stage 2). An untracked folder git does not look into (a repository inside this one) is
  listed with a trailing `/`.
- The status is read again when the window regains focus and when the watcher reports a change
  (`statusKeys.all(repoId)` is invalidated).

## How it works

- `git_core::diff::commit_changes` diffs the commit's tree against the parent's tree with gix
  (`blob-diff` feature: `gix-diff`, `gix-imara-diff`, MIT/Apache-2.0). Renames and copies are
  detected as the repository's git config says (`diff.renames`, `diff.renameLimit`). Folders are
  not listed, only their files.
- `get_changed_files(id, row, parent)` returns paths for display (lossy for non-UTF-8 bytes) and
  the old and new blob ids, so later views fetch contents by id, never by a path round trip.
- The query lives under the graph's query keys, so a graph reload refetches it.

## Not yet

- Added and removed line counts per file; a folder tree view; filtering the list.
- Staging from the list, the context menu of working tree files (M4).
