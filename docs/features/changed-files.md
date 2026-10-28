# Changed files

The **Changed files** module (Alt+5) lists the files the selected commit changed. Status: M3
slice 1. The diff of a chosen file arrives with the diff tab (slice 2).

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
- With a working tree row selected, it says that uncommitted files arrive in M4.

Choosing a file (click, arrows, Enter) stores it as the repository's selected file in
`features/selection` (`selectFile`). The selection is cleared when another commit is selected.

## How it works

- `git_core::diff::commit_changes` diffs the commit's tree against the parent's tree with gix
  (`blob-diff` feature: `gix-diff`, `gix-imara-diff`, MIT/Apache-2.0). Renames and copies are
  detected as the repository's git config says (`diff.renames`, `diff.renameLimit`). Folders are
  not listed, only their files.
- `get_changed_files(id, row, parent)` returns paths for display (lossy for non-UTF-8 bytes) and
  the old and new blob ids, so later views fetch contents by id, never by a path round trip.
- The query lives under the graph's query keys, so a graph reload refetches it.

## Not yet

- The diff of the chosen file (slice 2, the single diff tab).
- Added and removed line counts per file; a folder tree view; filtering the list.
- Changed files of uncommitted changes (M4).
