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
Staging and committing them is the Commit module's job ([commit.md](commit.md)); it shares this
module's row component and the chosen file.
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

## Context menu (owner request 2026-11-09)

Every file list has the same context menu (`FileContextMenu` in `src/features/file-menu/`):
Changed files (a commit's files and working tree files), the Commit module's two lists, Compare
and the Stash tab. Right click, Shift+F10 or the Menu key; right-clicking a row moves the cursor
to it first. From top to bottom:

- the list's own actions: **Show diff**; in the Commit module also **Stage** / **Unstage**,
  **Discard the changes…** and **Ignore…** (as the row's buttons);
- **Open working tree file**: the file on disk in its default app (`open_worktree_file`).
  Files whose default action runs them are refused with a hint (by extension: `.exe`, `.bat`,
  `.cmd`, `.ps1`, `.js`, `.vbs`, `.lnk`, `.url`, `.msi`, … on Windows, `.app`, `.command`,
  `.desktop`, … elsewhere; or by the executable bit): a repository is data, and opening a
  file must never run it (`git_core::locate`);
- **Show in Explorer** / **Finder** / **the file manager**: selects it there
  (`show_worktree_file`; a deleted file shows its nearest folder still on disk);
- **Save this version as…**: the listed blob (a deleted file's version before), for a commit,
  Compare or a stash;
- **Copy path**, **Copy full path** (with the repository folder's separator), **Copy name**;
- **File history**, and **Blame** at the listed commit (not for working tree or deleted files).

Both commands take a path relative to the working tree, refuse anything that climbs out of it
(`..`, absolute paths), and call the OS through `tauri-plugin-opener`'s Rust functions (MIT /
Apache-2.0); the webview gets no opener permission of its own. The Files tree's menu gained the
same **Open working tree file** and **Show in …** items.

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
- Staging from the Changed files list (the Commit module stages).
- **Open this version** (a commit's version in a temporary file) and **Open with…**.
