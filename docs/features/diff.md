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
- **Syntax colours**: code is coloured by its language, found by extension, file name or first
  line. The grammars are the 213 that `bat` ships, for example:
  - Rust, TypeScript and TSX, JavaScript, Python, C, C++ and C#;
  - Java, Kotlin, Swift, Go, Dart and Zig;
  - Vue, Svelte, HTML, CSS, SCSS and Less;
  - Markdown, JSON, YAML, TOML and INI;
  - Dockerfile, Terraform, Nix, GraphQL, Protobuf and SQL;
  - shell scripts, and git's own files (`.gitignore`, `.gitattributes`). Removed lines are coloured as the old version, the others as the new
    one. Files over 4 MB per side are not coloured. Settings → Diff can switch it off.
- **Options** in the header, saved in the settings (Settings → Diff) and used for every diff:
  - layout: Unified or Side by side (switching does not compute the diff again);
  - whitespace: show all changes, ignore at line ends (`--ignore-space-at-eol`), ignore changes
    in amount (`-b`) or ignore all whitespace (`-w`);
  - context: **−** and **+** step the unchanged lines around each change through 0–10, 15,
    20, 25, 30, 40, 50, 75 and 100; **Whole file** shows everything, and switching it off goes
    back to the number of lines.
- **Keeping its place**: changing the context, the whitespace option or the layout keeps the
  line in the middle of the view where it is on screen, like zooming in at that line. If the new
  context hides that line, the nearest line shown takes its place. Until the new diff is ready,
  the old one stays under a light blur with the loading bird (shown only if it takes over
  120 ms), instead of the tab going blank.
- **Selecting and copying**: drag over lines to select them and copy with Ctrl+C. Only the text
  of the lines is copied: no line numbers, no `+` or `-`, no hunk headers or notes. Side by side,
  a selection stays in the half it started in. Only rows on screen exist, so a selection reaches
  as far as you can drag without scrolling far away.
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
  - a working tree file that changed again while it was read (try again).
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
  grammars `bat` ships, from two-face 0.5.2 (MIT OR Apache-2.0; the grammars are under MIT,
  Apache-2.0 or Sublime HQ's licence), and pure-Rust regexes (`fancy-regex`). Each side is parsed along
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
- The settings are `diff.layout`, `diff.whitespace`, `diff.contextLines` and `diff.wholeFile`
  (`useDiffSettings` in `features/settings`).
  - The request asks for 4294967295 context lines for the whole file (`requestedContext`).
  - Settings saved by earlier versions with that number become `wholeFile` when read.
  - `ContextStepper` is the shared − / + / Whole file control.
- **Keeping the place** (`hooks/useShownDiff.ts`, `lib/anchor.ts`): the tab keeps showing the
  last ready diff of the same file while a new summary loads. It reads the line in the middle
  of the view from the cached rows, asks `find_diff_row` for the row showing that line in the
  new diff (`FileDiff::row_of_line` / `split_row_of_line`, nearest line when hidden, one pass
  over the rows), fetches the pages around it, and only then swaps the diffs, scrolled so the
  line keeps its offset.
- **Copying**: the body is `select-none` (desktop chrome); the text of each line is
  `select-text`, while the line numbers, the markers (with the screen-reader words "added:" and
  "removed:") and notes stay `select-none`. Side by side, a mouse down marks its half on the
  scrolling element (`data-selecting`), which makes the other half's text unselectable.
- The chosen path and the compared parent live in `features/selection` (`selectFile`,
  `compareWithParent`); `showDiffTab` in `features/workspace` opens the tab.
- **Working tree files** (M4 slice 1, `WorkingTreeDiff`): with a working tree row selected, the
  tab finds the chosen path in that row's status list. A staged file compares its `HEAD` blob
  with its index blob, like a commit's file. A changed, untracked or conflicted file still on
  disk compares a blob with the file itself:
  - `get_worktree_file_id` reads the file as git would store it (gix's filter pipeline:
    `core.autocrlf`, `eol`, `ident`, clean filters; a symlink as its target; files over 64 MB
    hashed as they are on disk) and returns the id it would have (`git hash-object`).
  - The request carries that id as `newId` with `worktree: true`. The backend reads the file
    again, checks it still has that id (`worktree_version`; otherwise "changed while it was
    being read") and diffs it (`worktree_diff`). Keys stay content-addressed, so the diff
    cache and the page queries need no other invalidation: a new version is a new id.
  - The id query lives under `statusKeys.all(repoId)`, refetched with the status on focus and
    on watcher changes. Images on disk come from `get_worktree_file_contents`.

## Performance

13 MB file, 200,000 lines, 2,000 scattered edits: 40–50 ms to diff, including the side-by-side
rows, and 0.06 ms per page of 500 rows (release build, Windows).

Syntax colours on a 3.7 MB Rust file (58,000 lines, 4,862 rows): about 120 ms per page of 500
rows, and 0.9 s the first time the last page is shown (every shown line before it is parsed
once). See
[performance.md](../development/performance.md).

The file tab ([files.md](files.md)) shows one version of a file with the same rows:
`file_view` makes every line an unchanged row without a hunk header, and `FileContents` renders
them with one line-number column.

A work tree without an index (`git clone --no-checkout`) has no checked-out `.gitattributes`, so
its files have no `diff` attribute; reading the attributes no longer fails there (found on the
Linux kernel clone during slice 7).

## Staging lines and hunks

In a working tree diff (Changed files with a working tree row selected, the Commit module docked
or popped out), `WorkingTreeDiff` passes `staging` (`worktree` or `index`) to `FileDiffView`,
unless the file is conflicted or a submodule. Commit diffs have none of this.

- Hunk headers get **Stage hunk** and **Discard hunk…** (working tree) or **Unstage hunk**
  (staged). A hunk is sent as the line ranges of its header, so it does not need its rows loaded;
  context lines in a range change nothing.
- The line numbers of a changed row are a button (mouse only; hunks have the keyboard
  reachable buttons) that chooses the line; Shift+click adds every changed line between the last
  clicked row and this one (rows loaded on screen). Chosen lines are keyed `o<old line>` and
  `n<new line>` (`lib/lineSelection.ts`) and forgotten when the file's ids change.
- `LineSelectionBar` (always one row high, so rows do not move) shows the hint, or the count with
  Stage, Discard…, Unstage and Clear. Discards confirm first (`ConfirmDialog`, destructive).
- The request names the versions the diff showed (`oldId`, `newId`); the backend refuses with
  "changed since its diff was shown" when the index or the file no longer match.

Backend (`git_core::commit::{lines, partial, index}`): both versions are compared again with
every whitespace change counted, and `combine` builds the new contents line by line: staging
starts from the old version and makes the chosen changes, unstaging and discarding start from
the new version and undo them. Any choice gives a valid file (a line that loses its place as the
last line gets a newline). The result is written with git:

| Action  | Old → new            | Writes                                                                                                                                              |
| ------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stage   | index → file on disk | `git hash-object -w --no-filters --stdin`, then `git update-index -z --index-info` (mode kept; new files 100644, or 100755 when executable on Unix) |
| Unstage | HEAD → index         | the same; when nothing staged is left, `git reset -- <path>` instead                                                                                |
| Discard | index → file on disk | the blob, then `git cat-file --filters --path=<path>` gives the bytes a checkout would write (line endings, smudge filters), written over the file  |

The index entry is read with `git ls-files --stage` (a conflicted path is refused), HEAD's with
gix. Selecting with whitespace ignored still works: the line numbers name real lines.

## External diff tool (M4 slice 6)

A button beside the file name (a window icon, **Open in diff tool**) opens the file's two
versions in another program. It is in every diff header (Diff tab, compare tab, Commit module),
not for submodules. **Settings → Diff → External diff tool** chooses the program:

| Choice                | Runs                                                                            |
| --------------------- | ------------------------------------------------------------------------------- |
| Git's diff tool       | `git difftool --no-index -y --tool=<diff.tool, else merge.tool> -- <old> <new>` |
| Visual Studio Code    | the same with `--tool=vscode` (git runs `code --wait --diff`)                   |
| A command of your own | the same with `--extcmd=<command>` (git appends the two files)                  |

- Everything goes through `git difftool`, so git's own table of tools (`meld`, `bc`, `kdiff3`,
  `p4merge`, `winmerge`, …), `difftool.<tool>.cmd`, `.path` and the repository's config apply
  as in a terminal (`git_core::difftool`, run in the working tree or, for a bare repository, the
  git folder).
- The tool is always named. Without `--tool`, git would guess one when `diff.tool` is unset or
  unknown, even vimdiff, which then runs with no terminal; NoBlame says "Git has no diff tool
  set" instead (`configured_tool` reads `diff.tool`, then `merge.tool`, with gix).
- The versions: a blob is written as a checkout would write it (`git cat-file --filters
--path=<path>`, so line endings and smudge filters apply) to
  `<system temp>/noblame-difftool/<pid>-<n>/<short id>/<file name>`; the file keeps its name so
  the tool recognises its type. A working tree side is the file itself, so edits made in the tool
  are kept. An absent side (added, deleted) is an empty file. A rename shows each side under its
  own name.
- `git difftool --no-index` exits with 1 when the files differ, like `git diff --no-index`; only
  other codes are failures, reported with git's message (an unknown tool, one not installed,
  a command not found).
- `open_external_diff` waits up to 1.5 s: a failure in that time is the command's error (a toast
  with the hint to check Settings). A tool still open then keeps running in the background; when
  it closes, its folder is deleted (a later failure is only logged). As with `git difftool`, the
  tool must wait until it is closed: VS Code's `--wait` does; a custom command that returns at
  once loses its files.

## Not yet

- Word diff: the changed words inside paired lines (slice 3b).
- Syntax highlighting (slice 3c).
- A construct opened between two hunks (a block comment starting in unchanged lines) is not
  seen by the colouring; choose the whole file as context to colour exactly.
- Diff drivers and `textconv` from `.gitattributes` (by design, see ADR 0013); previews of
  other binary formats; an image overlay or slider mode.
- Next/previous change shortcuts; search inside the diff.
- Choosing lines with the keyboard; staging lines of a renamed file's old name.
- Several diff tabs, or a diff in its own window (`noblame diff`); later.
- Terminal diff tools (vimdiff) from the external tool button: there is no terminal to run them
  in. A folder-wide external diff (`git difftool --dir-diff`), and merge tools (M6).
