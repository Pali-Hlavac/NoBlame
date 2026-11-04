# Stashes

The Stashes module (`stashes`, Alt+4) and the Stash tab (M4 slice 5). User guide:
[stashing.md](../user-guide/stashing.md). Design: [design/workbench.md](../design/workbench.md#stashes).

## Stashes module

- The active repository's stashes, newest first (`list_stashes`, the `refs/stash` reflog read
  with gix): `stash@{n}`, the message without git's `On <branch>:` prefix, the branch and date.
  Refreshed when the window regains focus, after every stash change, and by the file watcher.
- **Stash changes…** in its header opens `StashDialog`:
  - a message (optional; git writes `WIP on <branch>: …` without one);
  - the working tree's changed files, each once (staged and changed again is one row), all ticked
    (`CheckedFiles`: Space or the box ticks; **Choose all/none**);
  - **Include new files** (`--include-untracked`; untracked files are listed only then) and **Keep
    staged changes in place too** (`--keep-index`).
  - With every file ticked and both status lists complete (not cut at 5,000), no paths are passed,
    so git stashes everything; otherwise the ticked paths (both names of a rename) go on stdin
    (`--pathspec-from-file=- --pathspec-file-nul`, literal).
  - "No local changes to save" becomes an error ("There are no changes to stash…"), shown in the
    dialog with any other refusal.
- A click on a stash shows it in the Stash tab. Its **…** menu: **Show files**, **Apply**, **Pop
  (apply and drop)**, **Drop…**.

## Stash tab

A document tab (`STASH_TAB`, one at most, opened beside the graph with the diff and compare
tabs). It shows the stash chosen in the module for the active repository, remembered by commit id
(`store/shown.ts`), so it follows the stash when stashes are made or dropped (`stash@{n}`
changes); "This stash is gone" after a drop or pop.

- Header: `stash@{n}`, message, branch, date and file count; **Apply**, **Pop**, **Restore staged
  changes too** (`--index`, one choice for every stash), **Choose all/none**, **Apply N chosen**,
  **Drop…**.
- Files (`get_stash_files`): the tracked files the stash changed against the commit it was made
  on (its first parent; a gix tree diff, renames as in Changed files), then the untracked files it
  saved (its third parent, a commit of only those files; shown with `?`). Each has a tick box;
  choosing a row shows its diff beside the list (`FileDiffView`, by blob ids).
- Apply and Pop toast the result. Conflicts are a warning ("resolve them, then stage the files";
  a conflicting pop keeps the stash, as git does), not an error. When git refuses (local changes
  would be overwritten), its message is the error toast and nothing changed.
- **Drop…** asks first (`DropStashDialog`), naming the stash and its message: its changes are
  deleted for good, except what was applied.

## Applying chosen files

`apply_stash_files` merges the chosen files' changes into the working tree; the stash is kept.

1. Refused when a chosen tracked file differs from HEAD (staged or not; `git diff --name-only
HEAD -- <paths>`), naming up to five: the same rule as `git stash apply`.
2. The patch: `git diff-tree -p --binary --full-index <base> <stash> -- <tracked>` and
   `git diff-tree -p --binary --full-index --root <untracked commit> -- <untracked>` (200 paths
   per run, literal).
3. `git apply --3way`: a three-way merge with the blobs the patch names, so the change applies
   where the branch has moved on, and a real conflict is marked as `git stash apply` marks it.
   When git refuses (a new file is in the way), nothing changes.
4. `--3way` stages what it applied; `git reset -- <paths>` unstages the files without conflicts, so
   the result looks like a whole-stash apply: changes in the working tree, new files untracked,
   conflicts in the index.

The design first proposed `git restore --source=stash@{n}` (2026-10-28, "to be verified in M4").
It overwrites the files with the stashed versions, which would silently undo whatever the branch
changed in them since; the three-way patch keeps those changes.

## Backend

| Command             | Runs                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------- |
| `list_stashes`      | gix: the `refs/stash` reflog                                                          |
| `stash_changes`     | `git stash push [--keep-index] [--include-untracked] [--message=…] [paths on stdin]`  |
| `apply_stash`       | `git stash apply\|pop [--index] stash@{n}`                                            |
| `drop_stash`        | `git stash drop stash@{n}`                                                            |
| `get_stash_files`   | gix: the stash's tree diff against its first parent, and its untracked commit's files |
| `apply_stash_files` | see above (`diff`, `diff-tree`, `apply --3way`, `ls-files --unmerged`, `reset`)       |

- Every change holds the session's write lock. Apply, pop and drop first check (gix) that
  `stash@{n}` is still the commit the user chose (`StashError::Moved` otherwise), so a stash made
  in a terminal meanwhile never shifts the wrong one into place.
- An apply or pop that stops on conflicts exits non-zero with `CONFLICT` lines: reported as
  `conflicts: true`; any other failure changed nothing and is `StashError::Rejected` with git's
  output.
- Code: `crates/git-core/src/stash/` (`mod.rs` list and check, `write.rs`, `files.rs`,
  `partial.rs`), `src-tauri/src/worktree/stash*.rs`, `src/features/stashes/`.

## Not yet

- The stash label in the graph (next).
- `git stash push --staged` (stash only what is staged), `git stash branch`.
- Choosing several stashes at once.
