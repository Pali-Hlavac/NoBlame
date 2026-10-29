# Diff tab

The **diff tab** shows the line diff of the file chosen in Changed files. Status: M3 slice 2
(unified view), slice 3a (side by side, whitespace and context options), slice 3b (word diff)
slice 3c (syntax highlighting) and slice 3d (images, `.gitattributes`): slice 3 is done. Design:
[design/workbench.md](../design/workbench.md#diff-tab); ADR 0013.

## Behaviour

- There is one diff tab. Choosing a file in Changed files (click, arrows, Enter) opens it the
  first time, to the right of the active repository's tab, and focuses it after that, wherever
  it is docked. The tab's title names the file (`Diff: main.rs`).
- It follows the active repository: the selected commit, the parent a merge is compared with,
  and the chosen file. The file is remembered by path, so selecting another commit shows the same
  file there if that commit changed it too. Otherwise the tab says the file did not change in
  that commit.
- **Unified** rows: hunk headers (`@@ -10,7 +10,8 @@`), unchanged lines, removed lines (`-`,
  red) and added lines (`+`, green), each with its old and new line number. "No newline at end of
  file" is shown as git shows it. Line endings are not shown; tabs are 4 columns wide.
- **Side by side**: the old version on the left, the new one on the right. Each run of removed
  lines is paired line by line with the added lines after it; the shorter side is left empty.
  A missing newline at the end is noted after the line. Both halves scroll sideways together,
  through the scroll bar below them, shift + wheel, a trackpad, or the left and right arrow keys.
  With whitespace ignored, unchanged lines show each side's own text.
- **Changed words**: a removed line and the added line paired with it (the same pairs side by
  side shows) mark the words that differ in a stronger red or green. Lines longer than
  1,000 bytes and pairs with less than 30% in common are not marked, since nearly everything
  would be. Whitespace that the whitespace option ignores is not marked either.
- **Syntax colours**: code is coloured by its language (found by extension, file name or first
  line, from the grammars Sublime Text ships: Rust, TypeScript, Python, C, Java, Markdown, JSON,
  HTML and many more). Removed lines are coloured as the old version, the others as the new
  one. Files over 4 MB per side are not coloured. Settings → Diff can switch it off.
- **Options** in the header, saved in the settings (Settings → Diff) and used for every diff:
  - layout: Unified or Side by side (switching does not compute the diff again);
  - whitespace: show all changes, ignore at line ends (`--ignore-space-at-eol`), ignore changes
    in amount (`-b`) or ignore all whitespace (`-w`);
  - context: 3, 10 or 25 unchanged lines around each change, or the whole file.
- The header shows the file name, its folder (or the old name of a rename), the status and the
  added and removed line counts.
- **Images** (PNG, JPEG, GIF, WebP, BMP, ICO, AVIF) are shown before and after, side by side
  (above each other in a narrow pane), with their size and pixel dimensions, on a checkerboard
  so transparency shows. An added or removed image shows one side. SVG is text and gets a text
  diff. Images over 32 MB are not previewed.
- **`.gitattributes`**: a file marked `-diff` or `binary` is shown as binary, and one marked
  `diff` gets a text diff even if it contains NUL bytes. The attributes come from the work tree,
  as with `git diff`.
- Special cases, each with its own message:
  - other binary files (old and new size);
  - files over 64 MB (not compared);
  - files whose contents did not change (a pure rename, or only the mode changed);
  - only whitespace changed while whitespace is ignored;
  - empty added or removed files;
  - submodule pointers (old and new commit);
  - partial clones, where the old version of a file is not local;
  - uncommitted changes, which come in M4.
- Huge diffs scroll smoothly: only visible rows exist, their text arrives in pages of 500.
  Lines longer than 4,096 bytes are cut and marked. Diffs over 1,000,000 rows show the first
  1,000,000 and say so.
- Keyboard: Tab focuses the diff; arrows, Page Up/Down and Home/End scroll it.

## How it works

- `git_core::diff::file_diff(repo, old, new, options)` reads both blobs (`diff/load.rs`) and
  diffs them (`diff/file.rs`) with gix's imara-diff and git's slider heuristics. It honours
  `diff.algorithm`.
  - **Whitespace options:** lines are compared by a key with the ignored whitespace removed
    (`diff/options.rs`, git's whitespace characters).
  - **Rows:** hunks with the chosen context are built in `diff/rows.rs`, side-by-side rows from
    them in `diff/split.rs` (which also records the pairs), unified rows are rendered in
    `diff/unified.rs`, and the public row types are in `diff/lines.rs`.
  - **Word diff** (`diff/words.rs`): both lines are split into words, whitespace runs and single
    other characters, and the token sequences are diffed with imara-diff (Myers). Changed
    ranges go to the UI as `highlights`, `[start, end)` in UTF-16 code units, and are computed
    when a page is rendered.
  - **Tests:** every option is compared with `git diff --ignore-space-at-eol`, `-b`, `-w` and
    `-U` output.
- **Syntax highlighting** (`diff/syntax.rs`, `diff/highlight.rs`): syntect 5.3 (MIT) with its
  bundled Sublime Text grammars and pure-Rust regexes (`fancy-regex`). Each side is parsed along
  the lines the diff shows, carrying the parser state across the unchanged lines between hunks
  (as `delta` does). The state is saved every 256 shown lines, so a page costs its own lines.
  Scopes are reduced to eight classes (comment, string, keyword, constant, type, function, tag,
  attribute), sent as `syntax: [start, end, class]` in UTF-16 units and coloured with the
  `--syntax-*` tokens. The flag is part of the request and the cache key.
- `.gitattributes` (`diff/attributes.rs`): gix's attribute stack from the work tree and the index
  answers the `diff` attribute (`binary` is a built-in macro for `-diff`). The session reads it
  only when it computes a diff; it is part of `DiffOptions`.
- The session keeps the last 8 diffs (256 MB at most) in `repository/diff_cache.rs`, keyed by
  both blob ids, the path and the options, so paging and switching back cost nothing.
- **Commands:**
  - `get_file_diff(id, request)` returns the summary: kind, counts, sizes, line counts, and the
    unified and side-by-side row counts. The request names the two blobs, the path and the
    options;
  - `get_diff_lines` and `get_split_diff_lines` return up to 2,000 rows from a start row;
  - `get_file_contents(id, blobId)` returns a file's raw bytes (at most 32 MB) for image
    previews, like the graph blocks (`RawBytes`).
  - Blob ids come from `get_changed_files`.
- **Frontend:** `features/diff`.
  - `DiffView` resolves the chosen file and `FileDiffView` handles the special cases.
  - `DiffHeader` holds the options.
  - `DiffLines` (unified) and `SplitLines` virtualize and page with `useVirtualRows`; `DiffRow`
    and `SplitRow` draw one row, and `LineText` marks the changed words (`<mark>`, tokens
    `--diff-added-word` and `--diff-removed-word`).
  - Side by side moves its text with the CSS variable `--diff-scroll-x`, so scrolling sideways
    does not re-render rows.
  - Colours come from the `--diff-added`, `--diff-removed` and `--diff-hunk` tokens.
  - `ImageDiff` shows images. `objectUrlFor` makes one `blob:` URL per buffer and revokes it
    after the buffer is garbage-collected (no effect, so StrictMode cannot revoke a shown
    image).
- The settings are `diff.layout`, `diff.whitespace` and `diff.contextLines` (`useDiffSettings`
  in `features/settings`; 4294967295 lines means the whole file).
- The chosen path and the compared parent live in `features/selection` (`selectFile`,
  `compareWithParent`); `showDiffTab` in `features/workspace` opens the tab.

## Performance

13 MB file, 200,000 lines, 2,000 scattered edits: 40–50 ms to diff, including the side-by-side
rows, and 0.06 ms per page of 500 rows (release build, Windows).

Syntax colours on a 3.7 MB Rust file (58,000 lines, 4,862 rows): about 120 ms per page of 500
rows, and 0.9 s the first time the last page is shown (every shown line before it is parsed
once). See
[performance.md](../development/performance.md).

## Not yet

- Word diff: the changed words inside paired lines (slice 3b).
- Syntax highlighting (slice 3c).
- A construct opened between two hunks (a block comment starting in unchanged lines) is not
  seen by the colouring; choose the whole file as context to colour exactly.
- Diff drivers and `textconv` from `.gitattributes` (by design, see ADR 0013); previews of
  other binary formats; an image overlay or slider mode.
- Next/previous change shortcuts; search inside the diff.
- Diffs of uncommitted changes and staging hunks or lines (M4).
- Several diff tabs, or a diff in its own window (`noblame diff`); later.
