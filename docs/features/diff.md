# Diff tab

The **diff tab** shows the line diff of the file chosen in Changed files. Status: M3 slice 2
(unified view). Side by side, syntax highlighting, whitespace options, word diff and images
are slice 3. Design: [design/workbench.md](../design/workbench.md#diff-tab); ADR 0013.

## Behaviour

- There is one diff tab. Choosing a file in Changed files (click, arrows, Enter) opens it the
  first time, to the right of the active repository's tab, and focuses it after that, wherever
  it is docked. The tab's title names the file (`Diff: main.rs`).
- It follows the active repository: the selected commit, the parent a merge is compared with,
  and the chosen file. The file is remembered by path, so selecting another commit shows the same
  file there if that commit changed it too. Otherwise the tab says the file did not change in
  that commit.
- Rows: hunk headers (`@@ -10,7 +10,8 @@`), unchanged lines, removed lines (`-`, red) and added
  lines (`+`, green), each with its old and new line number. "No newline at end of file" is
  shown as git shows it. Line endings are not shown; tabs are 4 columns wide.
- The header shows the file name, its folder (or the old name of a rename), the status and the
  added and removed line counts.
- Special cases, each with its own message:
  - binary files (old and new size);
  - files over 64 MB (not compared);
  - files whose contents did not change (a pure rename, or only the mode changed);
  - empty added or removed files;
  - submodule pointers (old and new commit);
  - partial clones, where the old version of a file is not local;
  - uncommitted changes, which come in M4.
- Huge diffs scroll smoothly: only visible rows exist, their text arrives in pages of 500.
  Lines longer than 4,096 bytes are cut and marked. Diffs over 1,000,000 rows show the first
  1,000,000 and say so.
- Keyboard: Tab focuses the diff; arrows, Page Up/Down and Home/End scroll it.

## How it works

- `git_core::diff::file_diff` (in `diff/load.rs`, `diff/file.rs`, `diff/rows.rs`, `diff/text.rs`)
  reads both blobs and diffs them with gix's imara-diff and git's slider heuristics. It honours
  `diff.algorithm` and builds rows with 3 lines of context.
- The session keeps the last 8 diffs (256 MB at most) in `repository/diff_cache.rs`, so paging
  and switching back cost nothing.
- `get_file_diff` returns the summary; `get_diff_lines` returns up to 2,000 rows from a start
  row. Both take blob ids from `get_changed_files`.
- Frontend: `features/diff` (`DiffView` resolves the chosen file, `FileDiffView` handles the
  special cases, `DiffLines` virtualizes and pages, `DiffRow` draws one row). Colours come from
  the `--diff-added`, `--diff-removed` and `--diff-hunk` tokens.
- The chosen path and the compared parent live in `features/selection` (`selectFile`,
  `compareWithParent`); `showDiffTab` in `features/workspace` opens the tab.

## Performance

13 MB file, 200,000 lines, 2,000 scattered edits: 46 ms to diff, 0.06 ms per page of 500
rows (release build, Windows). See [performance.md](../development/performance.md).

## Not yet

- Side by side, syntax highlighting, word diff, whitespace options, more or less context (slice 3).
- Images and other binary previews (slice 3); `.gitattributes` `binary`/`-diff` (slice 3).
- Next/previous change shortcuts; search inside the diff.
- Diffs of uncommitted changes and staging hunks or lines (M4).
- Several diff tabs, or a diff in its own window (`noblame diff`); later.
