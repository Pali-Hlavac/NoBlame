# 0013: Diff viewer: diffs computed in Rust, rows paged into a virtualized list

- Status: Accepted
- Date: 2026-10-28
- Milestone: M3

## Context and problem

The diff tab shows the line diff of one file. Most diffs are a few dozen lines, but a Git client
for giant repositories also meets lock files, generated code, vendored libraries and data files
with hundreds of thousands of lines. A single diff can have more rows than the commit list of a
small repository. The first slice is the unified view. Side by side, syntax highlighting, word
diff, whitespace options and images follow in slice 3 and must fit the same design.

Questions: where is the diff computed, how does it reach the webview, and how is it drawn?

## Decision drivers

- Stay fast and small in memory for huge diffs; never send megabytes of JSON at once.
- Match `git diff` output (hunks, context, line numbers, "No newline at end of file").
- Only Rust touches repositories (ADR 0002); paths and contents are bytes.
- Leave room for side by side, highlighting and word diff without a rewrite.
- No GPL code.

## Options considered

1. **`git diff` through the CLI, parsed.** Exact git output, including external diff drivers and
   textconv. One process per file. The whole output is parsed at once, and the line numbers must
   be recovered from the hunk headers. Diff drivers can run programs, which a read-only view
   should avoid in an untrusted repository.
2. **gix in-process (imara-diff), rows computed in Rust and paged.** No process. Uses the same
   histogram/Myers algorithms and git's slider heuristics (`diff_with_slider_heuristics`). The
   repository's `diff.algorithm` is honoured. Both blobs and compact rows stay in a small
   per-session cache. The webview asks for a summary, then for pages of rows.
3. **Send both blobs to the webview and diff there** (a JavaScript diff library, or a Monaco or
   CodeMirror merge view). Simple, with editor features for free. But huge files cross the IPC
   bridge whole, the diff runs on the UI thread, and editor components are heavy and slow at
   100,000+ lines.

## Decision

Option 2.

- `git_core::diff::file_diff(repo, old, new)` reads both blobs (sizes first, from the object
  header), applies git's binary test (a NUL byte in the first 8,000 bytes), refuses files over
  64 MiB, and diffs line by line. Rows are built with 3 lines of context. Hunks closer than 6 lines are
  merged, as git does. A row is a small enum of line indexes (hunk header, context, removed,
  added, no newline). Text is cut out of the blobs only when a page is rendered, and lines are
  cut at 4,096 bytes for display.
- `get_file_diff(id, oldId, newId)` returns the kind (text, binary, too large), counts, sizes and
  the row count. `get_diff_lines(id, oldId, newId, start, count)` returns at most 2,000 rendered rows.
  Both are keyed by blob ids, which name the contents, so nothing can go stale. The session keeps
  the last 8 diffs, within 256 MB.
- The frontend fetches pages of 500 rows for the visible window (TanStack Query, keyed by blob
  ids) and renders only the rows on screen, with fixed 20 px rows. The line-number gutter is
  sticky while scrolling sideways.
- The diff tab is one tab in the main dock. It follows the active repository's selected commit
  and the file chosen in Changed files (by path, so it stays on the same file when the next
  commit changed it too).

## Consequences

- Measured on a 13 MB, 200,000-line file with 2,000 scattered edits, release build: the diff is
  ready in 46 ms; a page of 500 rows renders in 0.06 ms. Two unrelated 300,000-line files
  (600,001 rows) take 56 ms. `git diff` needs about 117 ms for the first case.
- External diff drivers and `textconv` are not used, by design. The `diff` attribute is honoured
  (slice 3d): `-diff` and `binary` show a file as binary, `diff` forces a text diff.
- Images are previewed from their raw bytes (`get_file_contents`, at most 32 MB) as `blob:`
  URLs (the CSP allows `img-src blob:`).
- Partial clones: old blobs may be missing locally. The diff then says so; it does not download
  them (git would fetch them on demand).
- Diffs longer than 1,000,000 rows show their first 1,000,000 rows (browsers cap element heights
  at about 33 million pixels). A scaled scroll bar like the commit graph's can lift this later.
- Side by side (slice 3a) is built in Rust from the same rows: context rows go to both columns,
  and each removed run is paired line by line with the added run after it
  (`diff/split.rs`, `get_split_diff_lines`).
  - Whitespace options compare lines by a key with the ignored whitespace removed. They and the
    context are part of the cache key; they match `git diff -w`, `-b`, `--ignore-space-at-eol`
    and `-U` in tests.
  - Word diff (slice 3b) is computed in Rust when a page is rendered, for each removed line and
    the added line paired with it, and sent as UTF-16 ranges. Syntax highlighting will be
    computed per page in Rust or per visible row in the webview (slice 3c).
