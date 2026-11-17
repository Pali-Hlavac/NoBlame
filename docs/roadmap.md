# Roadmap and plan

This is the delivery plan for NoBlame (drafted 2026-10-27). It is a living document: milestones,
scope and order may change, and slices are added at the start of each milestone. The product
requirements are in [project-brief.md](project-brief.md); where this plan differs, this plan
wins. Every milestone ends with a runnable, tested app, updated docs and a CHANGELOG entry.

Legend: `[x]` done · `[ ]` to do · `[~]` partially done / deferred (see note)

## Agreed product decisions

| Decision        | Detail                                                                                                                                                                                                                                                                                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Name            | **NoBlame** (CLI and binary: `noblame`). Chosen without "Git" in it because the Git trademark policy does not allow "Git" as part of a new product name; describe it as "a Git client" or "NoBlame for Git". Defined in one place (`src/app.config.ts` + `tauri.conf.json` `productName`), kept in sync by a test.                                                 |
| Logo            | A **finch on a branch** (the branch doubles as a Git branch line). Simple, flat and readable at 16 px; works on light and dark backgrounds; one master SVG in `assets/logo/` from which all platform icons are generated (`pnpm tauri icon`). Must not use or resemble the Git logo (also covered by the Git trademark policy).                                    |
| Two phases      | Phase 1: the main app (Git Extensions-style). Phase 2: shell integration (TortoiseGit-style context menus, overlays). Phase 2 starts only when phase 1 is good enough for daily use.                                                                                                                                                                               |
| Stack           | Tauri 2 + Rust; React + TypeScript + Vite + Tailwind 4 + shadcn/ui; TanStack Query + Zustand; `tauri-specta` (same stack as RipeMongo).                                                                                                                                                                                                                            |
| Git engine      | Reads with `gix` (gitoxide); writes and network through the installed `git` CLI. ADR 0007.                                                                                                                                                                                                                                                                         |
| Git requirement | The user's own `git` is required (not bundled in v1). Minimum version **2.39.0** (ADR 0007; revised from the tentative 2.40 because Debian 12 and Apple's Xcode CLT ship 2.39.x). The app detects it and explains how to install or upgrade.                                                                                                                       |
| Commit graph    | Lane layout in Rust, binary row batches over Tauri channels, virtualized canvas rendering, on-disk graph cache per repo. ADRs 0008-0010.                                                                                                                                                                                                                           |
| Entry points    | CLI (`noblame <command> <path>`), single instance, task windows. Built from M1. ADR 0015.                                                                                                                                                                                                                                                                          |
| UI layout       | **Workbench** (agreed 2026-10-28): an activity bar opens modules (repositories with nested submodules, branches, commit details, changed files, stashes, ...) in a left dock; a main dock holds repository (graph) tabs and one diff tab, splittable side by side; one saved layout, open tabs restored. See [design/workbench.md](design/workbench.md); ADR 0020. |
| Platforms       | Windows 10/11 x64 (+ arm64 later), macOS 12+ (universal), Linux x64 (AppImage, .deb, .rpm).                                                                                                                                                                                                                                                                        |
| E2E tests       | WebdriverIO + `tauri-driver` on Linux/Windows; no macOS E2E.                                                                                                                                                                                                                                                                                                       |

### Performance targets (measured on Linux, 1.5M commits, 2026-10-28)

| Scenario (reference: Linux kernel)             | Target                               | Measured (release, Windows 11)                                        |
| ---------------------------------------------- | ------------------------------------ | --------------------------------------------------------------------- |
| First rows of the graph visible, first open    | < 1 s                                | 482 ms with a commit-graph file; 10.9 s without (fresh clone)         |
| First rows visible, reopening (cache warm)     | < 300 ms                             | about 320 ms (estimated from the phases)                              |
| Whole history indexed in the background        | < 30 s, UI responsive throughout     | 9–13 s without a commit-graph file; the UI waits (not background yet) |
| Scrolling the graph                            | 60 fps, no blank rows on fast scroll | not measured yet                                                      |
| Memory for the graph                           | < 200 bytes per commit               | 88 bytes per commit                                                   |
| Working tree status, 100k files (fsmonitor on) | < 1 s                                | about 110 ms for 120,000 files (warm, fsmonitor off; 2026-11-06)      |

The first open without a commit-graph file misses the target by far. Options: offer to write
the file earlier (it took 11 s for Linux), or show rows while indexing. Decide in M3.

## Phase 1: main app

### M1: Scaffold, tooling, CI, docs

- [x] Cargo workspace: `crates/git-core` (no Tauri dependency) + `src-tauri` (+ `crates/repo-gen`)
- [x] Tauri 2 + React + TS strict + Vite + Tailwind 4 + shadcn/ui primitives
- [x] Typed IPC (tauri-specta), `AppError` model, strict capabilities (`main`, `task-*`)
- [x] First version of the finch-on-a-branch logo as an SVG; app icons for all platforms generated from it; shown in About and the window title bar
- [x] App shell: repository tabs, sidebar, status bar, command palette, theme, About
- [x] CLI parsing (`clap`), single-instance plugin forwarding arguments, open a window per task (placeholder views)
- [x] Git CLI runner: find `git`, report version, fixed locale, argument arrays, cancellable, `GIT_TERMINAL_PROMPT=0`
- [x] Synthetic repo generator (10k / 100k / 1M commits, branches, merges) for tests and benchmarks
- [x] ESLint/Prettier/rustfmt/clippy, file-size check, husky + lint-staged + commitlint
- [~] CI workflow (lint, types, tests on Linux/Windows/macOS): written; not run yet because the
  repository has no GitHub remote. Linux and macOS have not been built locally either.
- [~] Dependency audit (added 2026-11-14): `cargo-deny` (advisories, licences, crates.io only)
  and `pnpm audit` in `.github/workflows/dependencies.yml`, also weekly; `pnpm deps:check`
  locally. Passes locally; the workflow has not run yet (no GitHub remote).
- [x] `CLAUDE.md`, docs skeleton, `project-brief.md`, ADRs 0001-0007 + 0015, CHANGELOG. ADR 0008
      stays in M2 as the ADR plan below says (this line used to say 0001-0008).

Slices, in order: (1) workspace, root tooling and `git-core` runner with tests; (2) synthetic
repo generator; (3) `src-tauri`: error model, IPC registry, settings, git detection, CLI,
windows; (4) logo and icons; (5) frontend shell (tabs, sidebar, status bar, palette, theme,
About, task window); (6) verification in the running app; (7) CI; (8) docs, ADRs, changelog.

#### Where we left off (2026-10-27)

Built: everything above. Verified in the running dev app on Windows 11 (git 2.56.0): main
window, git status, theme switch persisted across a restart, palette, About,
`noblame .` / `noblame log <path>` / `noblame commit <path>` forwarded to the running
instance, a task-only first launch (`pnpm app:dev -- -- log crates`) opening just the task
window, `--help` / `noblame commit --help` / `--version` / usage errors (exit codes 0 and 2).
Synthetic repositories generated at 10k, 100k and 1M commits (timings in
`docs/development/performance.md`). `pnpm check` passes.

Fixed during verification:

- `noblame .` produced a tab named "." and Windows paths kept `/`: paths are now normalized
  with `std::path::absolute` (test added).
- The palette ranked by command id, so "about" selected "Close current tab": items now use the
  label as their search value (regression test fails without the fix).
- `fast-import` rejected the generator's stream (annotated tags take no trailing LF).
- Help showed `noblame.exe`; the binary name is now fixed to `noblame`.

Not verified yet: Linux and macOS builds (CI will be the first run), installer builds
(`pnpm app:build`), release-build `--help` console attach on Windows, the native folder
picker ("Open repository…" was not clicked through), the git-missing and git-too-old states
in the UI (covered by unit tests only).

Next: M2. Start with the spike (history walk with `gix` + commit-graph on
`.cache/repos/synthetic-1m`, measured), then the slices.

#### Open questions (owner decisions)

- **Licence**: none chosen yet (`publish = false`, no `license` field).
- **Bundle identifier**: `com.noblame.client` is a placeholder; changing it after release moves
  the settings folder.
- **GitHub repository**: needed for CI; the workflow is ready in `.github/workflows/ci.yml`.

### M2: Open repositories and the commit graph (the riskiest part, so it comes first)

- [x] Open / init / recent repositories (dashboard), several repos in tabs, detect bare/worktree/submodule
- [x] Spike first: history walk with `gix` + commit-graph file on a 1M-commit repo, measured
- [x] Lane layout in Rust (incremental, stable lane colors, merge/fork edges, octopus merges)
- [x] Binary row batches; format documented in `docs/architecture/ipc.md`. Changed from
      "streamed over channels" to on-demand 256-row blocks re-laid-out from checkpoints (ADR 0008).
- [~] Virtualized canvas graph: row heights, HiDPI, selection, keyboard navigation done; 60 fps
  and fast scrolling not measured yet, keyboard navigation not tried in the running app.
- [x] Columns: graph, message, author, date, hash; ref labels for branches, remotes, tags and
      HEAD done. Stash labels done in M4 slice 5.
- [x] "Artificial" rows for working tree and index changes at the top (as Git Extensions does);
      a setting chooses where they show (graph rows, a summary in the repository header, or
      hidden), owner request 2026-10-28. Status comes from `git status --porcelain=v2`; the file
      lists and staging are M4
- [x] Offer to write the commit-graph file (`--changed-paths`) when missing (not yet clicked
      through in the running app)
- [x] On-disk graph cache per repo; incremental update after fetch/commit — ADR 0010: the commit
      index is reused (previous build on reload, cache file on reopen); order and layout are
      recomputed
- [x] File watcher (debounced) refreshing refs and status: `notify` 8.2.0 (CC0-1.0) with
      `notify-debouncer-mini` 0.7.0 (MIT/Apache); ignored files filtered with gix's excludes; a
      refs change rebuilds the whole graph until the cache (ADR 0010) makes it incremental
- [x] Benchmarks recorded in `docs/development/performance.md`; measured on the Linux kernel
      (1.5M commits) and the targets revised above. Found and fixed: the layout pass scanned
      every lane per row (1.5 s → 150 ms)

Slices, in order (planned 2026-10-27):

1. **Spike**: `gix` open + commit index from the commit-graph file + date-topological order on
   `synthetic-1m`, measured with an example binary. Decide the graph data model from the numbers.
2. **Open repositories** (`git-core::repo`): discover, kind (normal, bare, linked worktree,
   submodule), HEAD, shallow, commit-graph present; refuse untrusted repositories like git.
3. **Graph engine** (`git-core::graph`): refs as tips, commit index, order, lane layout with
   checkpoints, binary block encoding, commit text for a row range; unit tests and benchmarks.
4. **IPC**: repository sessions, `load_graph`, binary `get_graph_block`, paged
   `get_commit_rows`, recent repositories, `init_repository`. ADR 0008.
5. **UI**: dashboard (recent, open, init) in the Welcome tab; repository tab with the virtualized
   canvas graph and columns, ref labels, selection and keyboard navigation. ADR 0009.
6. **Commit-graph offer**: notice plus a button that runs `git commit-graph write`.
7. **Artificial rows** for working tree and index changes.
8. **On-disk cache** and incremental update. ADR 0010.
9. **File watcher** refreshing refs and status.
10. **Measure** on the synthetic repositories (and Linux if available); revise targets.

#### Where we left off (2026-10-27, session 2)

Done: slices 1–6. The spike showed history is cheap (1M commits: index 104 ms, order 36 ms,
layout 190 ms) and refs dominate (10,570 loose refs 1.4 s, packed 242 ms); first screen of 1M
commits 624 ms with packed refs, under the 1 s target. `Graph::build` benchmark: 558 ms (1M),
96 ms (100k). Row order matches `git log --all --date-order` exactly (integration test).

Verified in the running dev app (Windows 11): `noblame <path>` on first launch opens the
1M-commit repository and draws it (graph built in ~1.5 s in the debug build), ref labels, HEAD
outline and HEAD selection. Fixed during verification: the first-launch path was dropped
(StrictMode drain, regression test added), graph column too wide, ref badges overflowing into the
author column, generator dates running to 2066.

Not verified in the running app: scrolling deep into the 1M history, keyboard navigation, the
folder picker, "Create repository…", the recent list, the commit-graph button, closing tabs
(session cleanup). These need someone at the keyboard; the logic is unit-tested.

Next (slices 7–10): artificial working-tree rows, on-disk cache (ADR 0010), file watcher, then
measure on a real large repository (Linux) and revise the targets. Agreed (2026-10-28): build
the M2.5 workbench first; see [design/workbench.md](design/workbench.md). Optimisation candidate: peel
refs with the packed-refs buffer (refs are now the largest cost).

#### Where we left off (2026-10-28, session 4)

Done: slice 7 (working tree rows, with the placement setting the owner asked for) and slice 9
(file watcher), before slice 8 because the rows needed live data and the cache's incremental
update will hang off the same change events.

- Status summary from `git status --porcelain=v2 -z` (read-only): about 170 ms for the 40,000
  files of synthetic-1m. gix status is still to be benchmarked against it (M4).
- Watcher: refs changes reload the graph (selection kept, or following HEAD); working tree
  changes re-read the status; ignored files are filtered with gix excludes.

Verified in the running dev app (Windows 11, through the WebView2 DevTools port): the rows and
their counts, selecting them, the header summary setting, refresh on focus, an external edit, and
external commits with HEAD or an older commit selected.

Then, same session: slice 8 (index reuse and cache, ADR 0010) and slice 10 (Linux kernel
measured, layout pass made 10× faster for wide histories, targets revised above). M2 is done
except measuring scroll frame rates, which needs someone at the keyboard.

M3 started: slice 1 (Changed files module). Not verified in the running app yet (the owner's dev
instance was running, and a second one only forwards to it); covered by integration and unit
tests. Next: slice 2, the diff tab (ADR 0013).

Then, same day: slice 2, the diff tab (ADR 0013, [features/diff.md](features/diff.md)). Diffs
are computed in Rust with gix (imara-diff, git's slider heuristics, `diff.algorithm`), checked
against `git diff` output in an integration test, cached per session and paged into a
virtualized list. A 13 MB file with 2,000 edits takes 46 ms.

Verified in the running dev app (NoBlame's own repository, through the DevTools port):

- Changed files and the diff tab together (this also covers slice 1);
- the tab opens in its own group right of the repository tab and is named after the file;
- arrow keys in Changed files switch the diff while the list keeps focus;
- selecting other commits keeps the file, or says it did not change there.

Known cosmetic issue: when scrolling sideways, a coloured row background ends at the pane width.
Next: slice 3 (side by side, highlighting, whitespace, word diff, images).

2026-10-29: the owner's new logo and icons (painted finch, hand-made `.ico`, transparent songbird
in the title bar). Slice 3 split into 3a (side by side, whitespace, context), 3b (word diff),
3c (syntax highlighting), 3d (images, binary attributes).

Slice 3a done. Verified in the running dev app:

- switching to side by side (pairs and empty halves correct);
- the shared sideways scroll bar and the wheel;
- ignoring all whitespace and showing the whole file (one hunk over the whole file);
- the toolbar in a narrow pane.

All options match `git diff` in an integration test.

Slice 3b done (word diff). Verified in the running dev app: the changed words of edited lines are
marked (for example "side by side, " in a CHANGELOG line), including a line split in two by
rustfmt (the moved part is marked).

Slice 3d done (image previews, `.gitattributes` `binary`/`-diff`/`diff`, `get_file_contents`).
Slice 3c done (syntax highlighting with syntect: licences checked, Oniguruma measured and
rejected, see ADR 0013 and performance.md). Slice 3 is complete. Next: slice 4, filters in the
repository tab (the owner's request).

Slice 4 is split into three parts:

- 4a: views of the graph, plus the branch, first-parent and no-merges filters;
- 4b: author and message;
- 4c: path.

Slice 4a done (ADR 0021):

- the filter bar in the repository tab;
- `set_graph_filter`;
- parent rewriting, and a new lane layout per view;
- commit details read from the full history.

It is checked against `git log` in an integration test. Measured: 28–230 ms per filter on the
Linux kernel.

The owner's dev app was running and in use, so it was not clicked through. Covered instead:

- a component test of the bar (toggles, branch picker, clear) with mocked IPC;
- a passive PrintWindow capture showing the bar.

New dependency: `@radix-ui/react-popover` 1.3.1 (MIT), for the branch picker.

Slice 4b done: message and author fields in the filter bar.

- Commits are read on up to 16 threads.
- A newer filter cancels the search under way.
- It matches `git log -i -F --author/--grep` in an integration test.
- Timing: 0.5–0.8 s on synthetic-1m, 1.2–1.9 s on the Linux kernel, where `git log --author`
  takes 13 s.

Not clicked through in the app, for the same reason as 4a. A component test covers the fields.

Slice 4c done: a Path field.

- `git rev-list --stdin <tips> -- <path>` lists the commits, so git's history simplification
  and changed-path Bloom filters apply. The result is intersected with the other filters.
- Paths are normalised: backslashes, `./`, and absolute paths inside the repository.
- The integration test matches `git log --all [--first-parent] -- <folder>`.
- Timing: 1.6 s on synthetic-1m (with Bloom filters), 6.2 s on the Linux clone (without).
- The filter bar wraps onto a second line in narrow panes rather than hiding a field. This was
  checked in passive captures of the owner's app.
- `sessions.rs` was split into `sessions/mod.rs` and `sessions/graph.rs` (300-line limit).

Slice 4 is complete. Next: slice 5, find in the graph and "go to commit".

2026-10-30, the owner's ideas: the sidebar width, diff context buttons and more languages are
done (see "M3 follow-ups"). The commit context menu is proposed as the new slice 5 (find moves
to 6); its entries are listed under "Commit context menu". External merge tools are in M6, and
the git output window in M5.

Slice 5 done: the commit context menu.

- Copy, highlight and Copy name work.
- The other entries are disabled and name their milestone.
- Right click selects the row first; Shift+F10 and the Menu key open the menu too.
- New dependency: `@radix-ui/react-context-menu` 2.4.1 (MIT; it shares the menu core with the
  dropdown menu).
- Covered by unit and component tests. Not clicked through in the running app (owner's instance
  in use).

Slice 6 done: find in the graph and go to commit.

- **Find bar** (Ctrl+F): ids, branch and tag names, authors and messages.
  - It searches once per query on up to 16 threads, then Next and Previous reuse the result.
  - Cost of the first search: 0.4–0.7 s on synthetic-1m, 0.7–1.8 s on the Linux kernel.
- **Go to commit** (Ctrl+Shift+G): any revision gix can resolve. It explains a commit the filter
  hides, and offers to clear the filter.
- `find_commit` and `go_to_commit`, with integration tests against git and component tests.
- `repository/find.rs` was split out of `service.rs` (300-line limit).

Not clicked through in the running app (owner's instance in use). Next: slice 7, file tree of
a revision.

Slice 7 done (2026-10-30): the files of a revision ([features/files.md](features/files.md)).

- **Files** module (Alt+6): the selected commit's tree, folders read as they are opened, with
  tree keyboard navigation and a context menu (Show, Save as…, Copy path, Copy name).
- **File** tab: the chosen file at the selected commit, with the diff tab's rows (line numbers,
  syntax colours, paging), images, and **Save as…** (native dialog opened in Rust; the bytes as
  stored). It shares a group with the diff tab.
- "Browse files at this commit" in the commit menu works.
- Fixed on the way: a work tree without an index (the Linux kernel clone) made every diff fail
  while reading `.gitattributes`.
- Checked in the running dev app:
  - the tree on the Linux kernel (folders 1–6 ms);
  - a 100,000-file folder (163 ms; 50,000 listed);
  - viewing a file of NoBlame itself;
  - where the file and diff tabs open;
  - the commit menu entry.
- Not clicked through: the native Save dialog (it would appear on the owner's screen; covered by
  a git-core test).
- In the dev app, the synthetic Alt+n events did not switch modules, also for Alt+3 and Alt+5
  (pre-existing; still to try on a real keyboard).
- A hot-module update during testing left dockview's document groups inconsistent, so opening a
  tab threw "invalid location" and blanked the window. It did not happen after a reload.

Slice 8, first half done (2026-10-31): file history ([features/history.md](features/history.md),
ADR 0022).

- **History** tab: the commits that change a file or folder, from the Files menu or the file
  tab's **History** button. Moving onto a commit selects it and shows the file's change.
- Renames are followed per branch: `git log -- <path>` for each name, gix rename detection where
  the file appears (also on the side of a merge).
  - git.git `builtin/log.c`: 1.3 s, 863 commits; `git log --follow`: 8.4 s, 589 commits.
  - Linux `MAINTAINERS`: 9.2 s (no Bloom filters in that clone).
- Blame is measured and decided (ADR 0022: `git blame --incremental`, 1.4–2 times faster than
  gix-blame on git.git), and comes in the second half.
- git.git is cloned into `.cache/repos/git` (full contents) as a benchmark for both.
- Not clicked through in the running app: the owner's instance was running. Covered by
  integration tests against git and component tests.

Slice 8, second half done (2026-10-31): blame ([features/blame.md](features/blame.md)).

- **Blame** tab from the Files menu or the file tab's **Blame** button: each hunk's commit
  (id, date, author, summary) beside the lines of the file tab, with a recency bar.
- Clicking a commit selects it; its menu shows the change, **blames the previous revision**
  (the parent and the old name from git's `previous` lines), or copies the id. **Back** returns.
- `git blame --incremental` with `GIT_NO_LAZY_FETCH=1`, so partial clones never download for
  it (checked by hand on the blobless Linux clone). git.git: 0.51–0.96 s for files of
  2,858–7,860 lines.
- The file view (`FileContents`) takes an optional gutter column; `VirtualList` reports its
  rendered range for paging.
- Not clicked through in the running app: the owner's instance was running for the whole slice.
  Covered by integration tests against git (renames, previous revisions) and component tests.

Slice 9 done (2026-11-02): the compare tab ([features/compare.md](features/compare.md), ADR
0023).

- Two revisions (references or anything typed), swap, and **only changes since they split**
  (merge base); the files that differ beside the chosen file's diff; commits only each side has.
- Opened from a commit's menu (**Compare with HEAD**), a branch's or tag's submenu (**Compare
  with the current branch**), Ctrl+click on a second commit, or the palette. "With the selected
  commit" became Ctrl+click: right click already selects.
- `git diff --raw` for the list: 0.21 s on git.git v2.40.0 → v2.50.0, where gix's rename
  detection took 4.0 s. Partial clones use gix with exact renames (git would spend 70 s trying
  to download, then fail). Under a second for 116,665 files on the Linux kernel.
- Changed files also falls back to exact renames when a partial clone lacks contents.
- Clicked through in the running app on git.git (the owner's instance was not running): Compare
  with HEAD, choosing a file, merge base mode, swap, a typed tag, Ctrl+click. Fixed there: the tab
  opened over the graph (it now opens with the diff and file tabs) and the empty state's wording
  in merge base mode.

2026-11-02, the owner's feedback after clicking through the checklist
([development/manual-checklist.md](development/manual-checklist.md)): the small items are done
(see "M3 follow-ups (owner, 2026-11-02)"); the larger ones are planned in M3 (graph columns,
slice 11), M4, M5 and phase 2. Checked in the running dev app on git.git and a submodule:
closing the diff in a split keeps the other half's tab, the Ctrl hint, selecting from after a
line's end, the scrollbars, print blocked in dev, clicking the oldest of 85,936 commits.

Then slice 10 (2026-11-02): commit details show children and the signature status (good, not
trusted, expired, revoked, bad, could not be checked; who signed it, the key and the verifying
program's output). Checked in the running dev app on a scripted repository with SSH signatures
and on git.git's GPG-signed commits.

Then slice 11 (2026-11-02): graph columns. Show or hide, move and resize the columns from the
column header (right-click menu, a columns button, dragging titles and edges) or Settings; dates
as "3 h ago". The titles now line up with the rows when there is a scrollbar. Clicked through in
the dev app on git.git with real mouse input: resizing the graph, the menu, relative dates,
moving Date before Message, Reset columns.

M3's planned slices are done. Left in M3: the later filters (committer, date range, several
branches, regular expressions) and the hidden mouse pointer to investigate.

M4 started (2026-11-02), slices planned below. Slice 1: the working tree rows' files in Changed
files and their diffs in the diff tab (staged: HEAD → index; changed: index → the file read as
git would store it, named by its `git hash-object` id). Status lists in 260 ms for 97,310
entries (Linux clone). Not clicked through: the owner's dev app was running; component and
integration tests cover it (CRLF conversion matches `git hash-object`).

Slice 2 done (2026-11-03): the Commit module (Alt+7) and the commit dialog, picked in Settings →
Committing (module by default; since 2026-11-04 the dialog is the Commit module popped out). Files are staged and unstaged one by one (button or Space) or
all at once, with a confirmation before marking conflicts resolved; Commit, Amend (fills in the
last message) and Sign off run the user's `git commit`, so hooks and signing apply, and a hook's
refusal is shown with its output. The toolbar's Commit button, the palette and the repository
**…** menu open it. Clicked through in the dev app on a scratch repository with real input
(staging, a `commit-msg` hook refusing, committing from the dialog with sign-off, Amend).

Slice 3 done (2026-11-03): hunks and single lines are staged, unstaged and discarded from the diff
(hunk buttons; line numbers clicked or Shift+clicked, then the bar above the diff), and whole
files are discarded from the Commit module, each discard after a confirmation naming what is
lost. The new contents are computed in-process and written with git (`hash-object`,
`update-index`, `cat-file --filters` for the working tree). Clicked through in the dev app:
staging two chosen lines, discarding a hunk (CRLF kept as a checkout writes it), unstaging a
hunk. Next: slice 4, the message (recent messages, `commit.template`, author).

Between slices (2026-11-04, owner request): any module can be popped out from its tab's menu
and then opens in a modal popup inside the app, keeping its state when closed; **Dock** puts it
back. The Commit module popped out is the former commit dialog, so the Settings → Committing
choice went away. Clicked through in the dev app: popping Commit and Branches out, the message
and the branch filter kept after closing, the choice kept after a reload, Esc closing a
confirmation inside before the popup, a commit from the popup, Dock.

Slice 4 done (2026-11-04): the message box offers the user's recent messages (**Recent ▾**,
read with gix, at most 2,000 commits back: 32 ms warm on the kernel), starts from
`commit.template` and leaves its comment lines out (`--cleanup=strip`), commits as another author
(`--author`, `Name <email>` checked on both sides), and measures the summary (50/72, line 2
empty). Not clicked through: the owner's dev app was running; covered by integration tests
against git (author and committer, stripped comments, recent messages, the template path) and
component tests. Next: slice 5, stash.

Slice 5 (2026-11-04): stashes are made (chosen files, message, keep index, new files), shown in a
Stash tab (its files and their diffs; a stash is not a graph row, so not in Changed files),
applied or popped (optionally restoring the index), dropped after a confirmation, and chosen
files applied with a three-way merge (`git apply --3way`, then unstaged) instead of the
`git restore` the design proposed, which would undo commits made since. Every change checks that
`stash@{n}` is still the stash shown. Clicked through in the dev app on a scratch repository:
showing a stash and a file's diff, applying a file with local changes (refused, named),
stashing one of two files with a message, applying one chosen file, dropping with the
confirmation.

Then the label: `stash@{n}` on the commit each stash was made on, added to the row text by commit
id (not a ref or tip, so its index and untracked commits stay out of the graph, the branch lists
and the filters). Clicked through: the label on the base commit, and a stash made in a terminal
labelled at once with the older one renumbered. Next: slice 6 (`.gitignore` helper, external diff
tool, compare with the working tree).

Slice 6, first part (2026-11-04): a commit is compared with the working tree from its menu, or
**Working tree** is picked as the compare tab's second side. The list is `git diff --raw <commit>`
(exact renames only in partial clones), each file's new side is read from disk (git's ids there
can name contents it never stored), and the comparison is read again with the status. 0.49 s
for `v2.40.0` against a git.git checkout.

Second part: the `.gitignore` helper. Untracked files in the Commit module's Changes list get
**Ignore…**: ready-made patterns (the file, its name, its extension, its folder) or a typed one,
the files it would hide listed before anything is written (two `git ls-files --others` runs,
about 0.1 s on git.git), and `.gitignore` or `.git/info/exclude` as the target.

Third part: **Open in diff tool** beside the file name in every diff header. Settings → Diff
chooses Git's `diff.tool` (NoBlame names it with `--tool`, so git never guesses a terminal tool),
VS Code (git's `vscode` tool) or a command of one's own (`--extcmd`); all run through
`git difftool --no-index` with blobs written as a checkout would write them and the working tree
file itself on the right. Slice 6 done (2026-11-04). Clicked through in the dev app on a scratch
repository: comparing a commit with the working tree (and the diff following an edit on disk),
both ignore files with the preview and a refused `#x`, the missing `diff.tool` message, and a
custom command (a script standing in for a tool) receiving both versions, its files removed
after it closed. VS Code itself was not opened (it would have appeared on the owner's screen).
Next: slice 7, the Repositories module counts (measured first).

Slice 7 (2026-11-06): measured first ([performance.md](development/performance.md#repositories-module-counts-m4-slice-7-2026-11-06)):
one `git status` per closed repository costs 60–130 ms warm (288 ms for the Linux clone's
97,310 entries, 110 ms for a checked-out tree of 120,000 files), so closed repositories run
it, at most 4 at a time; open ones reuse their session's status. Rows show `+new ~changed
−deleted`, each file counted once against `HEAD`, behind a setting that is off by default.
Clicked through in the dev app: the owner's repositories (counts matching `git status`), an
open demo repository following a deleted file at once, a restored tab not shown yet (counted
by path until its session opens; found in the click-through and fixed), and a closed one
counted again on focus. **M4 is done.** Next: M5 (branches, tags and remotes).

Decided (owner, 2026-10-28): a fresh clone of a huge repository without a commit-graph file
takes 10.9 s to show its first rows (Linux). Option 1 now: the commit-graph offer is
highlighted after a slow first load and names both costs (done). Option 2 later: show rows while
indexing in the background. Writing the file automatically could be a setting, off by default.

### M2.5: Workbench layout (agreed 2026-10-28; see [design/workbench.md](design/workbench.md))

Every later feature lands in this layout, so it comes before M3 and before the rest of M2
(working-tree rows, cache, watcher), as agreed with the owner.

- [x] Spike and ADR 0020: docking library (dockview vs. flexlayout-react) for a left dock and a
      main dock, with the canvas graph, our theme tokens, keyboard focus, saving/restoring layouts
- [x] Activity bar; left dock where modules open, stack as tabs or split, resize and collapse;
      module registry (one feature folder per module)
- [x] Main dock with document tabs: repository (graph) tabs that can be split side by side or
      above each other; room for the single diff tab (content in M3)
- [x] Active repository (last focused repository tab) and selected commit shared by all modules;
      selecting a commit updates every related module
- [x] Modules: Repositories (open and recent, submodules nested as a tree, opening a repository
      tab), Branches (local, remote, tags; read-only with filter), Commit details (message,
      author/committer, dates, hash, parents, refs and tags containing it), Stashes (read-only)
- [x] Toolbar for the active repository: Pull ▾ (pull, fetch, fetch all, fetch and prune), Push,
      Commit, Stashes, current branch. Operations arriving later are disabled and say which
      milestone delivers them
- [x] One saved layout for all repositories; open tabs restored between sessions; "Reset layout"
- [x] Keyboard: move focus between regions (F6), shortcuts to open modules
- [x] Docs, user guide, ADR 0020

#### Where we left off (2026-10-28, session 3)

M2.5 is done; see [features/workbench.md](features/workbench.md) and ADR 0020 (dockview-react
8.4.1, MIT). Slices:

1. workbench frame and layout persistence;
2. shared selection and Commit details;
3. Branches;
4. Stashes;
5. Repositories with nested submodules (enables gix `attributes`);
6. toolbar.

"Contained in" is computed from the graph: 5.5 ms for the oldest of 1M commits, which is
contained in 10,570 refs.

Verified in the running dev app (Windows 11, git 2.56.0):

- default and restored layouts;
- splitting the document dock;
- Commit details following the selection;
- Branches with 209 local branches;
- Stashes and the nested and uninitialized submodules of a scripted demo repository;
- the toolbar stubs;
- narrow panes (the commit list drops columns).

Fixed during verification:

- every new tab and module opened in a new dock group (dockview's `addPanel` without a position);
- the commit list squeezed its message column in narrow panes;
- the commit-graph notice wrapped badly.

Not verified in the running app (they need someone at the keyboard; the logic is unit-tested):

- F6 and the Alt+n hotkeys;
- clicking through the activity bar toggle;
- dragging tabs between groups;
- Reset layout;
- the Pull menu.

#### M2.5 follow-ups (owner review 2, 2026-10-28)

- [x] Settings button at the bottom of the activity bar; a Settings tab (theme, graph highlight,
      repository actions menu; shortcuts listed as M7)
- [x] "…" menu on open repositories in the Repositories module (Copy path, Close; Pull, Fetch,
      Push and Commit shown as M4/M5 stubs), with a setting to hide it
- [x] Selecting a commit highlights its history (lines leading into it, dimming the rest) and the
      commits by the same author; Esc clears it; setting to switch it off
- [x] Scrollbar flicker while resizing the window or a splitter (dock tab strips, commit list)
- [x] A remount of the workbench (hot reload in development) no longer replaces the open tabs with
      the ones restored at start

### M3: Inspecting history

- [x] Commit details module, complete: children, signature status (the basics are in M2.5).
      Children from the graph (5.6 ms for the oldest Linux commit); signatures checked with the
      user's git once the selection rests. Mergetag signatures (signed tags merged into a
      commit, as in the Linux kernel) are not shown yet
- [x] Changed files module for the selected commit (list, renames, merge parents); selecting
      a file shows it in the single diff tab, which switches files in place and stays where it is
      docked (several diff tabs: later)
- [x] Diff viewer (ADR 0013): unified and side by side, virtualized and paged for huge diffs,
      whitespace options, context lines, word diff, syntax highlighting, image previews, binary
      detection with `.gitattributes`
- [x] Changed files list and file tree of any revision; open/save a file at a revision
      (slice 7: Files module and file tab; opening in an external program later)
- [x] File history (following renames) and blame with "blame previous revision" (slice 8,
      ADR 0022)
- [x] Filters: branch(es), author, committer, message, path, date range, first-parent only, hide merges
      (owner request 2026-10-28: show only a branch, only an author, changes to a file, and a
      general search in messages). Done (ADR 0021): one branch or HEAD, first parent, no merges,
      message, author and path (slices 4a–4c)
- [ ] Filters, later: committer, date range, several branches at once, regular expressions
- [x] Context menu on commits in the graph (owner request 2026-10-30), see the list below;
      the same entries in the Branches module follow with M5
- [x] Find in the graph (hash, message, ref) with jump-to; "go to commit"
- [x] Compare any two commits/branches (slice 9, ADR 0023; with the working tree: M4 slice 6)

Slices, in order (planned 2026-10-28):

1. **Changed files** module: the files the selected commit changed (against its first parent;
   merges and other parents later), with status and renames; gix tree diff.
2. **Diff tab**: one tab in the main dock showing the selected file's unified diff, virtualized,
   switching files in place. ADR 0013.
3. Side-by-side view, whitespace options, word diff, syntax highlighting, images and binaries.
4. **Filters** in the repository tab (owner request): one branch, one author, changes to a path,
   search in messages; first-parent and hide merges.
5. **Context menu on commits** (owner request 2026-10-30, proposed first so the later slices add
   their entries to it). Copy and highlight entries work at once; every other entry is shown
   disabled with the milestone that delivers it, like the toolbar.
6. Find in the graph and "go to commit".
7. File tree of a revision; open or save a file at a revision.
8. File history (following renames) and blame.
9. Compare two commits or branches.
10. Commit details: children and signature status.
11. Graph columns (owner request 2026-11-02): choose which columns show, their order and
    width; the date as absolute or relative ("1 h ago", "3 d ago").

#### Commit context menu (proposed 2026-10-30, to be confirmed by the owner)

On any commit row:

| Entry                                                                  | Arrives                    |
| ---------------------------------------------------------------------- | -------------------------- |
| Copy full id / short id / subject / whole message                      | M3                         |
| Highlight this commit's history (and clear the highlight)              | M3                         |
| Compare with HEAD / with the working tree / with the selected commit   | Done (slice 9; M4 slice 6) |
| Browse files at this commit; save a file from it                       | Done (slice 7)             |
| Check out this commit (detached HEAD, explained in the dialog)         | M5                         |
| Create branch here… / Create tag here…                                 | M5                         |
| Merge into the current branch                                          | Done (M6 slice 1)          |
| Rebase the current branch onto this commit                             | Done (M6 slice 3)          |
| Interactive rebase from here                                           | Done (M6 slice 6)          |
| Cherry-pick / Revert this commit                                       | Done (M6 slice 2)          |
| Reset the current branch to here (soft, mixed, hard with confirmation) | Done (M6 slice 2)          |
| Mark as good / bad (bisect)                                            | Done (M7 slice 3)          |
| Create a patch; save an archive (zip, tar) of this commit              | Done (M7 slice 4)          |
| Run a user script with this commit                                     | Done (M7 slice 6)          |

When branches or tags point at the commit, a submenu for each one offers:

- check out (M5);
- merge into the current branch (M6);
- rebase onto it (M6);
- rename, delete, push, set upstream (M5);
- delete or push a tag (M5).

The Branches module gets the same entries for its rows.

#### M3 follow-ups (owner, 2026-10-30)

- [x] The left dock keeps its width in pixels when the window is resized
      (`groupResizeBehavior: "preserve-pixel-size"`)
- [x] Diff context with − and + buttons (0–100 lines in steps) and a separate Whole file switch
      (`diff.wholeFile`; older settings are migrated)
- [x] Syntax highlighting for many more languages: two-face 0.5.2 (bat's 213 grammars, MIT OR
      Apache-2.0; grammars MIT, Apache-2.0 or Sublime licence), speed unchanged

#### M3 follow-ups (owner, 2026-11-02)

- [x] Clicking the oldest commit of a long history (scrolled to the end) moved the list up a
      row: fractional display scaling rounds the end of the list differently
- [x] Closing the last tab in one half of a split switched the other half to another
      repository: dockview reports no focused tab at that moment, and the store took the closed
      tab's neighbour in its own list; a tab already on screen is chosen now
- [x] Holding Ctrl (Cmd) over another commit shows "Click to compare with …" at the pointer
- [x] Selecting text in the diff and file tabs can start after the end of a line
- [x] Scrollbars drawn by the app (thin, theme colours), the same on every system
- [x] The window can be moved by dragging the start screen while the app loads
- [x] Ctrl+P (print) blocked in development builds too
- [x] Repository groups, brought forward from M5 at the owner's request: created, renamed,
      folded, filled and ordered by drag and drop or right-click, saved in
      `repository-groups.json`; clicked through in the dev app (drags with real mouse input)
- [x] The module's sections fold and can be reordered by dragging their titles (saved in
      Settings). Not clicked through: the owner's app was running; component tests cover it
- [x] Graph columns and relative dates (slice 11): show or hide, order and width of the columns,
      dates as date and time or "3 h ago"; from the column header (right-click, a columns
      button, dragging titles and edges) or Settings → Commit graph
- [ ] The mouse pointer stayed hidden after using the palette with the keyboard and opening the
      native folder dialog ("Open repository…"); moving the mouse did not bring it back. To
      investigate (Windows hides the pointer while typing; WebView2 may not show it again)

### M4: Working copy and committing

#### M4 follow-ups (owner, 2026-11-03; confirmed, done the same day)

- [x] Coloured icons by kind of work. Icons stay lucide (ISC licence, line icons whose stroke
      takes any colour); the colours are theme tokens (`--kind-*`, light and dark), so a kind is
      recoloured in one place. Unified the same day at the owner's request, one colour per kind
      everywhere: commits and committing green (Commit details too), stashes amber, history
      teal, branches and remotes violet, repositories blue (also Open and Create), groups orange
      (also New group), submodules purple
      ([features/workbench.md](features/workbench.md#colours-by-kind-of-work)).
- [x] Repositories module colours: groups orange, repositories blue, submodules purple.
- [x] Initials badge for people: a small circle with up to two initials, in Commit details
      (author, committer) and before the graph's Author column; later in blame and file
      history. Its hue comes from a fixed hash of the e-mail address (FNV-1a of the trimmed,
      lower-case address; the owner chose the e-mail over the name), so it is the same on every
      device; lightness and saturation come from the theme so
      it stays readable in light and dark.
- [x] Repositories in groups (and initialized submodules) get the same "…" button as open ones (Copy path, Open, Remove from
      group; Pull, Fetch, Push and Commit shown as stubs until they arrive), and later the
      configurable Pull and Push buttons (M5).

- [~] Status: staged, unstaged, untracked, conflicted; fast on large trees (`--no-optional-locks`, fsmonitor, untracked cache).
  Lists and diffs done (slice 1); gix status still to be benchmarked on a checked-out 100k+
  file tree
- [x] Stage/unstage files, hunks and single lines; discard changes (with confirmation). Files
      (slice 2); hunks, lines and discarding (slice 3)
- [x] Commit dialog: message editor with templates, amend, sign-off, GPG/SSH signing via git, author override, hooks output shown.
      Amend, sign-off, signing (the user's `commit.gpgSign`) and hooks' output done (slice 2);
      `commit.template`, recent messages, author override and summary hints (slice 4). NoBlame's own
      list of templates is in the backlog
- [x] Commit window as a modal dialog or as a module in the left dock; a setting picks one (owner
      request 2026-10-28; slice 2). Replaced 2026-11-04 by popping the module out
- [x] Pop out any module from its tab's right-click menu: it then opens in a modal popup inside
      the app (keeping its state when closed) until **Dock** puts it back (owner request
      2026-11-04)
- [x] Commit message history and recent-message reuse (slice 4)
- [x] Stash: create from selected files (checkbox list, message, keep index, include untracked),
      list (Stashes module), show (files and diffs in the dock), apply/pop a whole stash or only
      selected files, drop with confirmation; stash label in the graph (slice 5; a stash shows in its
      own Stash tab, its label on the commit it was made on)
- [x] `.gitignore` helper: ignore file/extension/folder from the status list (slice 6; an
      **Ignore…** button on untracked files in the Commit module, with a preview)
- [x] Open a file's diff in an external diff tool from the diff tab (`git difftool` settings, or
      a preset such as VS Code `code --wait --diff`). Slice 6: Git's `diff.tool`, VS Code or a
      command of one's own, all through `git difftool --no-index`
- [x] Repositories module: the number of added, changed and deleted files beside each
      repository, behind a setting (owner request 2026-11-02). Open repositories have their
      status already; closed ones need a `git status` each, so that is measured first. Slice 7:
      `+3 ~2 −1` on Open, Groups and Recent rows, off by default

Slices, in order (planned 2026-11-02):

1. **Working tree files** (done 2026-11-02): one `git status` run gives the counts and the file
   lists (staged; changed, untracked, conflicted). Selecting "Working tree changes" or "Staged
   changes" in the graph lists their files in Changed files, and the diff tab shows a file's
   diff (staged: HEAD → index; unstaged: index → the file as git would store it).
2. **Commit module and dialog** (done 2026-11-03; a setting picks one): unstaged and staged
   lists, stage and unstage files (or all), the message, Commit, Amend, Sign-off, hooks' output
   shown; the toolbar's Commit button becomes real.
3. Stage and unstage hunks and single lines from the diff; discard changes (files, hunks) with a
   confirmation naming what is lost (done 2026-11-03).
4. The message: recent messages, `commit.template`, author override, summary length hints
   (done 2026-11-04).
5. Stash: create (selected files, message, keep index, untracked), show, apply or pop (whole or
   selected files), drop; the stash label in the graph. Done 2026-11-04.
6. `.gitignore` helper, external diff tool from the diff tab, compare with the working tree
   (left from M3 slice 9). Done 2026-11-04.
7. Repositories module counts (measured first). Done 2026-11-06.

### M5: Branches, tags and remotes

- [x] Branches and tags: create, rename, delete (unmerged warning), checkout/switch, track upstream.
      Slice 1 (2026-11-06), upstreams slice 2 (2026-11-06)
- [x] Ahead/behind counts per branch; actions in the Branches module (checkout, create, rename,
      delete, track). Slices 1 and 2, 2026-11-06. (Submodules and Worktrees modules: M7)
- [x] Toolbar operations: Fetch, Fetch all, Fetch and prune (`git fetch --prune`), Pull
      (merge/rebase/ff-only), Push (incl. tags, force-with-lease behind confirmation) as background
      jobs with progress. Fetch (slice 3) and pull and push (slice 5), 2026-11-06
- [x] Quick Pull button on repository rows in the Repositories module, behind a setting (owner
      request 2026-10-28; quick Merge follows with merging in M6); the "…" menu's Pull, Fetch and
      Push become real. Settings choose which buttons show: Pull and Push on each repository,
      Pull all and Push all on each group (owner request 2026-11-02). Slice 6, 2026-11-06
- [x] Repository groups in the Repositories module (owner request 2026-11-02): folders like
      bookmarks, to sort repositories into, collapse and expand. Done early, on 2026-11-02
      ([features/repositories.md](features/repositories.md#groups)).
- [x] **Pull all** (merge) and **Push all** on a group, one job per repository, summed up in one
      toast (slice 6, 2026-11-06)
- [x] Credentials: git credential helpers; `GIT_ASKPASS`/`SSH_ASKPASS` helper that asks in the app — ADR 0012
      (slice 4, 2026-11-06)
- [x] Manage remotes; clone dialog (shallow, single branch, partial clone, recursive submodules)
      (slice 8, 2026-11-07)
- [x] Background job registry: progress, cancel, logs, "equivalent command" shown — ADR 0011
      (slice 3, 2026-11-06)
- [x] Git output window (owner request 2026-10-30):
  - a console-like popup that streams the output of pull, push, fetch, clone and other long
    operations while they run;
  - a setting, off by default; the operations then run in the background, with their output
    kept in the job log.
  - Slice 7, 2026-11-06: a non-modal window at the top right, closing itself after a success
    (a second setting), any job openable in it from the jobs list.

Slices, in order (planned 2026-11-06). Local work first, so the network parts start on a
working branch model; the job registry comes before anything that talks to a remote:

1. **Branches and tags, locally**: check out a branch, a commit (detached, explained) or a
   remote branch (as a new tracking branch); create a branch (optionally checking it out),
   rename, delete (a confirmation naming the commits no other branch or tag holds); create a
   tag (lightweight or annotated), delete one. From the commit menu, the branch labels' menus
   and a context menu in the Branches module. Git refusing (local changes in the way) shows
   what git said. Done 2026-11-06 ([features/branches.md](features/branches.md)).
2. **Upstreams and ahead/behind**: each local branch shows its upstream and ahead/behind in the
   Branches module (measured on thousands of branches first); set and unset the upstream.
   Done 2026-11-06: upstreams are listed at once, ahead/behind counted for the rows on screen.
3. **Job registry and Fetch** (ADR 0011): jobs with progress, cancel (whole process tree),
   logs and the equivalent command; a jobs list in the status bar; Fetch, Fetch all remotes,
   Fetch and prune from the toolbar and the "…" menu. Done 2026-11-06 (ADR 0011,
   [features/remotes.md](features/remotes.md)); the "…" menu fetches closed repositories too.
4. **Credentials** (ADR 0012): git's credential helpers as they are; an in-app askpass for user
   names, passwords and SSH passphrases when nothing else answers. Done
   2026-11-06 ([features/remotes.md](features/remotes.md#credentials)).
5. **Pull and Push**: pull (merge, rebase, fast-forward only), push (new branches get an
   upstream, tags, force-with-lease behind a confirmation), push and delete a branch or tag on
   the remote from the menus. Done 2026-11-06 ([features/remotes.md](features/remotes.md#push));
   the lease names the commit the dialog showed, not just "where the last fetch saw it".
6. **Repositories module buttons**: Pull and Push on each repository, Pull all and Push all on
   each group (one job per repository), each shown by a setting; the "…" menu's entries real.
   Done 2026-11-06 ([features/remotes.md](features/remotes.md#repositories-module)); Push
   without a dialog goes to the upstream only (`push_current_branch`), else says to use Push….
7. **Git output window**: the console-like popup streaming a job's output, behind a setting.
   Done 2026-11-06 ([features/remotes.md](features/remotes.md#git-output-window)).
8. **Remotes and clone**: add, rename, remove a remote and change its URL; the clone dialog
   (shallow, single branch, partial clone, recursive submodules). Done 2026-11-07
   ([features/remotes.md](features/remotes.md#managing-remotes)); Fetch all remotes became one
   fetch per remote, so it shows progress.

The Submodules and Worktrees modules named above move to M7 with their actions (submodules are
listed in the Repositories module already).

**M5 is done (2026-11-07).** Next: M6 (changing history and resolving conflicts).

### M6: Changing history and resolving conflicts

- [ ] Merge (ff/no-ff/squash) _(done, slice 1)_, rebase, cherry-pick, revert, reset (soft/mixed/hard behind confirmation) _(cherry-pick, revert, reset done, slice 2; rebase onto done, slice 3)_
- [x] Interactive rebase editor: reorder, squash, fixup, reword, edit, drop; autosquash (slice 6)
- [x] In-progress operation banner (merge/rebase/cherry-pick/bisect) with continue/skip/abort
- [x] Conflict resolution: list, ours/theirs (slice 4), built-in three-way merge view (slice 5) — ADR 0014
- [x] External diff and merge tools (configured like Git Extensions, honoring `diff.tool`/`merge.tool`)
      with presets (VS Code `code --wait --merge`, Beyond Compare, KDiff3, Meld, P4Merge);
      "Open in merge tool" on each conflicted file (owner request 2026-10-30)
- [x] Reflog browser with "restore this state" (slice 7)

Slices (planned 2026-11-09): 1. merge and the in-progress bar; 2. cherry-pick, revert, reset; 3. rebase onto; 4. conflicts: list, ours/theirs, external merge tools; 5. the three-way merge
view (ADR 0014); 6. the interactive rebase editor; 7. the reflog.

Slice 1 done (2026-11-09): merge and the operation in progress
([features/operations.md](features/operations.md)).

- **Merge into the current branch…** from a commit, a branch, remote branch or tag (graph and
  Branches module): fast-forward when possible, `--no-ff`, `--ff-only` or `--squash`.
- The bar above the commits for any operation in progress (also one started in a terminal or by
  a pull) with Continue, Skip and Abort; the status carries the operation, so it follows every
  refresh.
- Found while clicking through: git writes a full ref name into the merge message as given
  ("Merge branch 'refs/heads/topic'"); the short name is used when it is unambiguous.
- Checked in the running app on a scratch repository: a conflicting merge, Abort, merging again,
  resolving in a shell, Continue (merge commit with git's message), a clean `--no-ff` merge.

Slice 2 done (2026-11-09): cherry-pick, revert and reset ([features/operations.md](features/operations.md)).

- **Cherry-pick…** and **Revert…** in the commit menu: commit at once or only stage, `-x`, the
  parent of a merge commit (`--mainline`). A pick that would be empty is skipped and reported
  (git 2.39 has no `--empty=drop`); conflicts bring up the bar.
- **Reset the current branch to here…**: soft, mixed (default), keep, hard. The dialog is the
  confirmation: the commits that leave the branch (`get_missing_commits`) and, for hard, how
  many files lose uncommitted changes (untracked files are kept and not counted).
- `CommitList` moved from the branches feature to the graph feature, so the operations feature
  can show commits without depending on branches (which depends on it).
- Checked in the running app on a scratch repository: a cherry-pick with `-x`, the same pick
  again (reported as nothing to do), a conflicting pick and Skip, a staged revert finished with
  Continue, a hard reset with a changed and an untracked file, a merge reverted against parent 1.

Slice 3 done (2026-11-09): rebase onto ([features/operations.md](features/operations.md)).

- **Rebase the current branch onto this… / onto it…** on commits, branches, remote branches and
  tags (graph and Branches module). The dialog names the commits replayed and warns in red when
  some were pushed already (on a remote-tracking branch); stash changes meanwhile
  (`--autostash`, ticked when tracked files changed) and keep merge commits (`--rebase-merges`).
- Continue and Skip now say where they left the operation: finished, stopped again at the next
  conflict (no longer shown as an error), or still going.
- Checked in the running app on a scratch repository with a local bare origin: rebasing a branch
  with three commits (two pushed) and a changed file onto `origin/main`, the conflict at step 2
  of 3, resolving in a shell, Continue ("The rebase is finished"), the stashed change back.

Slice 4 done (2026-11-09): conflicts ([features/operations.md](features/operations.md#resolving-conflicts)).

- **Resolve…** in the bar and **Resolve conflicts…** on a conflicted file in the Commit module
  open the list of conflicted files (`git ls-files -u`), naming who ours and theirs are (swapped
  during a rebase), with **Merge tool**, **Use ours**, **Use theirs** ("(delete)" where that side
  deleted the file), **Mark resolved**, and either side for all files.
- **Settings → Diff → Merge tool for conflicts**: Git's `merge.tool`, VS Code, Beyond Compare,
  KDiff3, Meld, P4Merge (git's own names), or another tool git knows. It runs through
  `git mergetool`, which stages the file when the tool resolved it.
- Found on the way: `git mergetool` exits 0 with "No files need merging"; that is reported as
  no conflict, not as resolved.
- Checked in the running app on a scratch repository (a merge with two files changed on both
  sides and one deleted on ours), with a stand-in merge tool set in that repository's
  `merge.tool` that writes the file and exits (no window on the owner's screen): the tool
  resolved one file, Use theirs another, Use ours (delete) the third, then Continue finished the
  merge. A real GUI tool was not started.

Slice 5 done (2026-11-09): the built-in merge view
([features/operations.md](features/operations.md#the-merge-view), ADR
[0014](adr/0014-conflict-resolution-ui.md)).

- **Merge** in Resolve conflicts (and **Merge in NoBlame** in the Commit module's file menu)
  opens the **Merge** tab: the file merged line by line from the index stages, each conflict
  with ours and theirs side by side (the base on request) and Use ours, Use theirs, both in
  either order, or an edit; **Save and mark resolved** stages the result and writes the file
  from the index, so line endings and filters apply as for a checkout.
- Found on the way: **Next conflict** first used `scrollIntoView`, which also scrolled the tab's
  outer container and hid the header; it now scrolls only the list.
- Checked in the running app on a scratch repository (a merge with a 30-line file with two
  conflicts, changes from each side and one the same on both; a CRLF file; a binary file): the
  two conflicts were the ones git marked; ours for one and an edit for the other saved the
  expected file (index and working tree equal); a line typed in the CRLF file was stored with
  CRLF; the binary file was refused with its reason; then Use theirs and Continue finished the
  merge. The Commit module's new menu entry was not clicked.

Slice 6 done (2026-11-10): the interactive rebase editor
([features/operations.md](features/operations.md#interactive-rebase)).

- **Interactive rebase from here…** in the commit menu lists the commit and those after it up to
  HEAD, oldest first, to move (arrows, Alt+Up/Down) and pick, reword, edit, squash, fix up or
  drop; new messages are edited in place; **Arrange fixup! commits** does what `--autosquash`
  does. Pushed commits and left-out merge commits are named first.
- git gets the list through `GIT_SEQUENCE_EDITOR` (a shell function copying NoBlame's file with
  builtins only); new messages are `exec` lines amending from `printf`, so no editor or message
  file is involved.
- Found on the way: counting the pushed commits put `--not --remotes` before the range, which
  turned the range around (every commit counted as pushed); the range now comes first. And a
  squashed `squash! X` commit's subject is now left out of the combined message, as git does.
- Checked in the running app on a scratch repository with a local bare origin (six commits, two
  pushed, a `fixup!` and a `squash!`): the warning named the two pushed commits; Arrange put the
  fixup and the squash under their commits; a reword with `$HOME`, backticks and a quote in its
  body, the squash, and an edit on the last commit; the rebase stopped at the edit (the bar and
  the toast), Continue finished it; the files and messages were as expected.

Slice 7 done (2026-11-10): the reflog ([features/reflog.md](features/reflog.md)).

- The **Reflog** module (Alt+8): HEAD's reflog or a local branch's, newest first (gix, at most
  5,000 entries); choosing an entry selects its commit, or says only the reflog has it. Its
  menu: **Restore this state…** (the reset dialog, starting on Keep), **Create a branch
  here…**, **Check out this commit…**, **Copy commit id**.
- Found while clicking through: the reset dialog's default (mixed) is wrong for restoring: the
  branch moved back but the files stayed, so restored files looked deleted. Restore now starts
  on Keep. Also the newest entry showed a date instead of "just now" (the clock ticks once a
  minute), and the chosen row moved to another entry when one arrived on top.
- Checked in the running app on a scratch repository where a hard reset lost two commits: the
  lost commit was reported as only in the reflog; Restore this state put main back on it with
  its files and a clean tree; a commit made in a terminal appeared on top while the chosen row
  stayed; a branch's own reflog. 200,000-line reflog: 2.5 ms (performance.md).

**M6 is done (2026-11-10).** Next: M7 (advanced Git: submodules, worktrees, LFS, bisect,
patches).

### M7: Advanced Git

- [x] Submodules: status, init/update, diff of submodule pointers (listing and opening them is in
      the M2.5 Repositories module). Slice 1
- [x] Worktrees: list, add, remove, open (slice 2)
- [x] Git LFS: detect, show pointers vs. content, lock/unlock (slice 5)
- [x] Bisect workflow (good/bad/skip from the graph) (slice 3)
- [x] Patches: create (format-patch), apply (am/apply); archive a revision (slice 4)
- [x] User scripts / custom commands with placeholders (`{sha}`, `{branch}`, `{file}`) like Git Extensions scripts (slice 6; git commands, no `{file}` yet)
- [x] Settings: repo and global git config editor (explicit; slice 7), app preferences, keyboard shortcuts
      (configurable in the Settings tab, owner request 2026-10-28; one keybinding registry first;
      slice 8)

Slices (planned 2026-11-10), the Git features first, then the app's own:

1. **Submodules**: their state in the Repositories module (not initialized, checked out at
   another commit than the one recorded), initialize and update as jobs, and the commits
   between the two pointers when a submodule changed (diff tab).
2. **Worktrees**: a Worktrees module listing them; add (new or existing branch), open as a
   repository tab, remove (naming uncommitted changes), lock and unlock, prune stale entries.
3. **Bisect**: start from the commit menu (good, bad), mark good, bad or skip from the graph,
   the bisect marks in the graph, the bar while it runs, the result, reset.
4. **Patches and archives**: create patches of a commit or a range (`format-patch`), apply a
   patch or a mailbox (`git am`, `git apply --3way`, checked first), save an archive of a
   revision (zip, tar.gz).
5. **Git LFS**: detect LFS, files shown as pointer or content, the locks (list, lock, unlock).
6. **User scripts**: commands with placeholders run from the menus, their output in a job.
7. **Git config editor**: the repository's and the global settings, explicit and named.
8. **Keyboard shortcuts**: one registry, configurable in Settings.

Slice 1 done (2026-11-10): submodules ([features/submodules.md](features/submodules.md)).

- The Repositories module shows which submodules are not initialized and which have "new
  commits" (checked out elsewhere than recorded). **Initialize**, **Update to the recorded
  commit** and **Update all submodules** run `git submodule update --init --recursive` as a
  job; moving submodules with new commits asks first.
- The diff tab of a submodule shows where its pointer went and the commits in between (added
  and removed), and for the working tree whether it has files of its own changed.
- Found while clicking through: "Open the submodule" was offered for one not checked out
  (its empty folder would have opened the parent); the diff kept saying "not checked out"
  after an update; the tree only noticed a submodule moved in a terminal on window focus
  (now also on the watcher's changes); commit rows were cramped in a narrow tab.
- Checked in the running app on a clone whose submodules were not initialized: Initialize,
  Update all, a submodule moved in a terminal (badge, diff with the commit added and its own
  changed file), Update back (the dialog, the local change kept), a commit bumping the pointer
  (two commits listed), Open the submodule (a tab inside its parent's tree).

Slice 2 done (2026-11-10): worktrees ([features/worktrees.md](features/worktrees.md)).

- The **Worktrees** module (Alt+9, with Repositories and Branches in the default layout): each
  worktree with what it has checked out, badges for main, this tab, locked and folder gone;
  a click opens it as a tab. **Add a worktree…** (a new branch, a free branch or a commit; the
  folder suggested next to the main one), **Remove…** (naming uncommitted files, then
  forcing), **Lock…**/**Unlock**, **Prune**.
- Found while clicking through: worktrees added, removed or switched in a terminal did not
  show until a refresh (the watcher now reports `.git/worktrees/<name>` and its `gitdir`,
  `HEAD` and `locked` files, not its index); the folder field hid the end of a long path (now
  also shown in full below it); the "main" badge read like the branch `main` (now "main
  worktree").
- Checked in the running app on a scratch repository with a linked worktree and one whose
  folder was deleted: Add (a new branch, opened as a tab), Remove of one with a new and a
  changed file (named, then forced; its branch kept), Lock with a reason and Unlock, Remove
  disabled for this tab's worktree, Prune, the branch choice leaving out branches checked out
  elsewhere, and worktrees added, removed and switched in a terminal.

Slice 3 done (2026-11-10): bisect ([features/operations.md](features/operations.md#bisecting)).

- The commit menu's **More**: **Bisect: mark as bad**, **good**, **skip**; the first mark explains
  bisecting and starts it. The bar while bisecting says what to mark next or which commit is
  tested and how many are left, with **Good**, **Bad** and **Skip**; once found, **Show it** and
  **Stop bisecting**. The marks are graph labels (`bad` red, `good` green, `skipped` grey), a ref
  kind of their own kept out of the Branches module and the filters.
- Found while clicking through: the labels read `bisect/bad` (gix's short name keeps the
  folder); the start dialog said the commit "is marked bad" before anything happened. Measured
  after: counting what is left on every refresh took 73 s on the Linux kernel's v5.0..v6.1, so the
  bar keeps the count git prints with each mark.
- Checked in the running app on a 20-commit scratch repository broken from commit 13: bad on
  the newest, good on commit 6, then Bad, Good, Good, Good from the bar found commit 13; Show
  it, Stop bisecting (back on main, marks gone); a bisect started in a terminal showed in the
  bar, Skip, and Stop after asking.

Slice 4 done (2026-11-11): patches and archives ([features/patches.md](features/patches.md)).

- Commit menu → **More** → **Create patches…** (the commit, or the commits after a base; one
  file or one per commit, never replacing files) and **Save an archive…** (zip or tar.gz as a
  job, named after a tag). **Apply patches…** in the Commit button's menu and the palette:
  what the files hold, a check first, then commits (`git am --3way`) or only the files
  (`git apply`, falling back to `--3way`).
- Found while clicking through: several patch files changing the same lines did not apply
  together (git applies separate files each to the original; they now go as one stream); a
  merge commit offered "Only this commit", which has no patch.
- Checked in the running app on a scratch repository with a tag and a merge: the count after
  `v1.0` (4 commits, the merge left out), an unknown base explained, the archive dialog named
  `app-v1.0`, Apply patches from the toolbar; three mails checked (in name order, "conflicts" on
  the branch that has them, clean on one at `v1.0`) and applied as three commits through the
  app's commands. The system's file dialogs were not clicked (they would open on the owner's
  screen); saving and applying are covered by tests against git.

Slice 5 done (2026-11-11): Git LFS ([features/lfs.md](features/lfs.md)).

- The **Git LFS** module (Alt+0): the LFS files with their sizes, **pointer only** for those
  whose content is not downloaded, **Download contents** (`git lfs pull` as a job), the locks
  on the LFS server when asked (lock from a file's row, unlock, forcing asks first), and what to
  do without git-lfs or without an LFS server.
- Found while clicking through: with `--json`, `git lfs locks` answers an empty list and
  succeeds when it cannot reach a server (the reason goes to stderr), so the module said
  "Nobody holds a lock"; it now shows git-lfs's words and what they mean.
- Checked in the running app on a clone made with `GIT_LFS_SKIP_SMUDGE=1` (three files, one in
  a folder with a space): all three pointer only; Download contents ran the job and the badges
  went; Show locks on the folder remote explained there is no LFS server. Locking against a
  real server (GitHub, GitLab) was not tried: none is set up for tests.

Slice 6 done (2026-11-11): user scripts ([features/scripts.md](features/scripts.md)).

- **Settings → Scripts**: a name and git's arguments with placeholders (`{sha}`, `{short}`,
  `{subject}`, `{branch}`, `{repo}`), checked before they are added. Commit menu → **More** →
  **Run a script** runs one as a job (output in the jobs list and the Git output window). The
  backend reads the script by name from the settings, splits it into arguments without a shell,
  fills the placeholders in each argument and refuses a value that would become an option.
- Found while clicking through: a script typed with a leading `git` was shown as `git git …`
  (it is now stored without it). At the right edge of the screen the third-level menu opens to
  the left over its parent; the keyboard (→, Enter) reaches it.
- Checked in the running app: added `Tag done` (`git tag -m {subject} done-{short} {sha}`) in
  Settings, ran it on a commit from its menu: the tag `done-156e97c8` with the subject as its
  message. Not yet: programs other than git, a confirmation option, `{file}`.

Slice 7 done (2026-11-11): Git settings ([features/git-config.md](features/git-config.md)).

- **Settings → Git settings**: whose settings first (this repository's `.git/config`, or the
  user's for every repository), the file named; common settings named and explained, the
  file's others listed, any other added; written only on Save, Remove or Add
  (`git config --replace-all` / `--unset-all`, key and value after `--`).
- Found while clicking through: the Remove buttons wrapped onto their own lines in the
  settings column (the name now sits above the field).
- Checked in the running app on a scratch repository: "This repository's (app)" with
  `File: .git/config`, its name and email shown; Pull by rebasing set to `true` and saved
  (`git config --local pull.rebase` said true). The user settings were not opened (they are
  the owner's); reading and writing the global file is covered by the same code with
  `--global`.

Slice 8 done (2026-11-11): keyboard shortcuts ([features/workbench.md](features/workbench.md#settings-button)).

- First step: one keyboard shortcut registry (`src/shared/lib/keybindings.ts`): the palette,
  settings, F6 regions, tabs, find and go to, commit, and the ten module shortcuts read their
  keys from it; **Settings → Keyboard shortcuts** lists them by group.
- Then: each shortcut changed there by pressing new keys, saved in the settings as the changed
  ones only and applied at once (key handlers, the palette, tooltips, the Welcome tab). Plain
  keys, editing keys (copy, paste, undo) and keys another shortcut has are refused, saying why;
  Backspace leaves one without keys; one or all can be reset.
- Checked in the running app: Find commits given Ctrl+K (refused, naming the palette, which did
  not open), then Ctrl+Shift+F (saved; in the repository tab Ctrl+F no longer opened the find
  bar and Ctrl+Shift+F did; the palette listed Ctrl+Shift+F); the palette's keys removed with
  Backspace (None, Ctrl+K did nothing, the status bar lost its key); Reset all shortcuts (the
  settings list empty, Ctrl+K opened the palette again). Noticed: Ctrl+Tab follows the order
  tabs were opened across both document groups, so a press can land on a tab already showing
  in the other group and seem to do nothing.

**M7 is done (2026-11-11).** Next: M8 (standalone task windows).

### M8: Standalone task windows (prepares phase 2)

- [x] `noblame log|commit|diff|blame|filehistory|pull|push|fetch|switch|merge|rebase|stash|clone|init <path>` open focused windows
- [x] Path-scoped views: log and status limited to a folder or file (log: slice 1; status: slice 2)
- [x] Windows reuse the running instance; closing the last task window exits when the main window is not open
      (slice 1: one window per task and path; sessions closed with their window)
- [x] Documented CLI reference (`docs/features/cli.md`), `--help` output tested (slice 6)
- [x] Setting: close a task window once its action succeeded (commit, pull, push, …), like
      TortoiseGit (owner request 2026-11-12; off by default, owner decision 2026-11-17)

Slices (planned 2026-11-12). A task window is the main window's workbench made for one task:
the modules and tabs that task needs, opened on the given path, its layout never saved.

1. **The frame and Log**: task windows show a workbench with the task's modules and tabs and
   a bar naming the task, the repository and the path, with **Open in NoBlame** (the main
   window). Repository sessions belong to the window that opened them and close with it. The
   same task on the same path focuses its window instead of opening a second one. `log` shows
   the graph limited to the folder or file given (the path filter).
2. **Commit and Diff**: the Commit module and the working tree's changes, limited to the
   folder or file given (path-scoped status).
3. **Blame and File history** of the file (or folder) given.
4. **Fetch, Pull and Push**: the dialogs, the job's progress and output, credentials asked in
   that window.
5. **Switch, Merge, Rebase and Stash**: the branch and operation dialogs on the repository.
6. **Clone and Create repository**, then the CLI reference and `--help` checked by tests; ADR
   0015 brought up to date.

Slice 1 done (2026-11-12): the task window frame and Log ([features/cli.md](features/cli.md#task-windows-m8),
[architecture/cli-and-windows.md](architecture/cli-and-windows.md#task-windows-m8)).

- A task window is a workbench with the task's modules and tabs (`src/app/tasks/specs.ts`),
  layout not saved, under a bar naming the task, repository and folder with **Open in
  NoBlame**; the dialogs and the credential prompt are mounted as in the main window. Task
  windows got the repository commands (`capabilities/task.json`).
- `log`: the graph filtered to the path (`get_path_scope`, then the path filter before the
  graph first loads).
- One window per task and path; repository sessions belong to the window that opened them and
  close with it (`RepoSessions::remove_owned_by`).
- Checked in the running app: `noblame log <repo>\src` (3 of 5 commits, `src` in the filter
  bar; only this window opened), the same command again (focused, no second window), `log
<repo>\docs` (a second window, 1 commit), **Open in NoBlame** (the main window with the
  repository tab), closing the main window (task windows stayed; 3 sessions closed), then each
  task window (1 session each; the app ended with the last). Fixed on the way: **Open in
  NoBlame** opened the folder given, so the tab was named after it; it now opens the
  repository's top folder. Noticed: in development every `noblame.exe` run rewrites the
  bindings, the hot reload resets the "layout not saved" switch and the task window's save is
  refused (dev only).

Slice 2 done (2026-11-12): Commit and Diff windows ([features/cli.md](features/cli.md#task-windows-m8)).

- The window's status is limited to the folder or file given (`get_status` with a scope: `git
status -- <path>`, and the staged files elsewhere counted by `git diff --cached`); Stage all
  and Unstage all act on that path; the Commit form says what else a commit takes.
- `commit`: the Commit module beside the diff tab; `diff`: Changed files beside it. Opened on a
  file, its diff shows at once.
- Checked in the running app on a scratch repository (changes in `src` and `docs`, `README.md`
  staged): the Commit window listed only `src` and said "Also commits 1 file staged outside
  src"; Stage all staged only the `src` files; the chosen file's diff showed; Unstage all left
  `README.md` staged; `noblame diff <file>` opened on that file's diff. Fixed on the way: a file
  path failed to open ("path is not a directory"); discovery now starts in the file's folder.
  Noticed: the empty diff tab says to choose a file in Changed files (Alt+5), which the Commit
  window does not offer; choosing it in the Commit lists works.

Slice 3 done (2026-11-12): Blame and File history windows ([features/cli.md](features/cli.md#task-windows-m8)).

- `blame`: the file as it is in `HEAD` (resolved with `go_to_commit`), beside Commit details and
  Changed files; a folder is refused with a hint. `filehistory`: the history tab of the file or
  folder (the top of the repository: its graph).
- Checked in the running app: Blame of `src/deep/a.txt` (two lines, two commits; a line's
  commit shown in Commit details), File history of `src` (3 commits), Blame of `docs` (the
  explanation).

Slice 4 done (2026-11-12): Fetch, Pull and Push windows ([features/cli.md](features/cli.md#task-windows-m8)).

- The graph and Branches, with the task's dialog opened at once and from the bar: a new Pull
  and Fetch dialog (`src/app/tasks/RemoteTaskDialog.tsx`; the choices the toolbar offers), the
  existing Push dialog. Pull and push refuse a detached HEAD with a hint.
- Jobs: every window gets job events, so only the window that started a job shows its output
  window and toasts (`features/jobs/lib/own.ts`); task windows show the output window for every
  job they start. Credential prompts still show in every window (answering one closes the
  others).
- Checked in the running app on a scratch repository with a bare remote: pull (fast-forward,
  output and toast in the Pull window), pull and push with the main window open (nothing
  there), push (remote updated), fetch all remotes (Branches showed master one behind).
  Noticed: in development each `noblame.exe` run rewrites the bindings and the hot reload
  remounts open task windows, which then open their dialog again (dev only).

Paused here at the owner's request (2026-11-12), resumed 2026-11-17 with slice 5.

Slice 5 done (2026-11-17): Switch, Merge, Rebase and Stash windows, and closing a task window
once its action succeeded ([features/cli.md](features/cli.md#task-windows-m8)).

- `switch`, `merge`, `rebase`: the graph and Branches, and a question at once (and from the
  bar): which branch, remote branch or tag, filtered as typed, or a revision typed in; merging
  and rebasing start on the upstream. The choice goes to the graph menu's actions, so checkout,
  "Create and check out", the detached HEAD explanation, the Merge and the Rebase dialogs work
  as in the main window. An operation in progress is named instead.
- `stash`: Stashes beside the graph, **Stash changes** at once; "Stash changes" is now mounted
  once per window (`openStashChanges`). Limited to a folder, it stashes only the chosen paths
  (before, choosing every listed file stashed the whole working tree).
- Settings → Task windows → **Close a task window once its action succeeded** (off): actions
  report success (`shared/lib/actionDone.ts`), the window of that task closes 1.5 s later.
- The palette and the repository header no longer call every task window a placeholder; only
  Clone and Create repository are.

Slice 6 done (2026-11-17): Clone and Create repository windows, the CLI reference
([features/cli.md](features/cli.md)).

- `clone` and `init` show a form, not a workbench (`FolderTaskWindow`): Clone with the path as
  the folder that will hold the clone (the form is now shared with the main window's dialog),
  its progress, then **Open in NoBlame**; Create repository with what is at the folder first
  (`inspect_folder`, new in git-core `repo/folder.rs`: missing, empty, filled, a file, inside a
  repository, a repository already), then `git init`.
- `--help` of each task names what its path is (`TaskKind::path_help`); tests compare
  `noblame --help` and every task's path with `docs/features/cli.md`, and check `--version` and
  usage errors (exit code 2). ADR 0015 brought up to date.
- The placeholder view (`TaskWindowView`) is gone; the palette lists the task windows about the
  active repository without "placeholder".
- Checked with tests only so far: the owner's dev app was running (slices 5 and 6 wait for a
  click-through, see the manual checklist).

**M8 is done (2026-11-17).** Next: M9 (polish and release).

Quality of life before slice 5 (owner request 2026-11-13; see the ideas inbox in
[design/workbench.md](design/workbench.md#ideas-inbox)):

- [x] Graph: the rest of the commit message, greyed, after the subject (setting, off by default)
- [x] Commit module: files folder first, sorted by the whole path (setting; name first stays the
      default)
- [x] Commit module: several files chosen at once (Ctrl, Shift, Ctrl+Shift) and staged together
- [x] Icons in context menus, coloured by kind of work: the commit graph's and the Branches
      module's (`shared/lib/actionIcons.ts`)
- [x] Module stacks: two or more modules in one tab, one above the other; framed together in
      the activity bar
- [x] Activity bar: drag to reorder (stacks move together), lock, hide icons under "…"

Done 2026-11-13, with tests; not clicked through in the running app (the owner's dev app was
running, and a second instance would forward to it): see the manual checklist.

The owner's notes of 2026-11-16 (see the ideas inbox):

- [x] Graph: the working tree row highlights HEAD's history
- [x] Document tabs: closing one shows the one used last, also after the layout changed
- [x] Commit module: arrows keep moving between files after staging with Space
- [x] Graph: an arrow on a branch label with an upstream selects the other's commit
- [x] Files module: a filter box for the whole tree
- [x] Submodules: fetch and pull include them; update after pull and checkout (setting); a bar
      offering the update; **Check out the recorded commit** on a changed submodule
- [x] Settings: search
- [x] Command palette: **Create a branch**
- [x] Create a branch dialog: nothing outside it
- [x] Repositories module: uncommitted file counts for submodules
- [x] Commit module: more room for the lists
- [x] Submodule graph: labels for the main repository's local branches

Done 2026-11-16, with tests. Checked in the running app on a scratch repository with a
submodule and a bare remote: the upstream arrows (both ways), the working tree row's highlight,
Settings search, the Files filter, the Commit lists (Space twice, then the arrows move; the
compact and folded message area, the splitter beside the diff), **Check out the recorded
commit** (asks first), the submodule bar (Update), the superproject labels in the submodule's
graph, Create a branch from the palette, closing a tab (the one used before shows), and a
checkout with "update after pull and checkout" on (the submodule followed). Seen once and not
reproduced since: after closing Settings with its ×, the Settings button did not open it again
until the page reloaded. Found and fixed in M9 slice 1 (a hot reload left the tabs store
connected to a disposed dock).

### M9: Polish and release

Slices (planned 2026-11-17; the logo's artwork stays with the owner):

1. The app icon chosen in Settings (owner request 2026-11-17: a second, vibrant icon)
2. Window sizes and positions, and each repository's graph filters, remembered
3. Keyboard and accessibility pass
4. A separate profile for tests (`NOBLAME_PROFILE_DIR`) and E2E smoke tests (ADR 0016)
5. Third-party licence notices, generated and shipped, shown in About
6. Release workflow and auto-update (ADR 0017), `release.md` finalized

Slice 1 done (2026-11-17): Settings → Appearance → **App icon**, Golden (the installed
program's) or Vibrant. Every open window changes at once, new ones open with it.

- Windows: the hand-made `.ico` of each variant is built into the app
  (`src-tauri/icons/icon.ico`, `vibrant.ico`) and each window gets the picture drawn for the size
  Windows asks for (big: taskbar and Alt+Tab; small: the title bar), by DPI
  (`src-tauri/src/windows/icon.rs`, `WM_SETICON`). Linux gets the window icon from the `.ico`'s
  256 px PNG. macOS windows have no icon; the Dock keeps the installed one. The installed
  program, its shortcuts and Explorer keep the golden icon (built into the executable).
- `pnpm icons` also copies `assets/logo/noblame_vibrant.ico` and writes the 256 px previews to
  `public/` (`scripts/icons.mjs`).
- Fixed: after a hot reload while the window started (a dev run rewriting the bindings), the
  Settings button and other tab changes did nothing until the page was reloaded: the document
  dock's connection to the tabs store was made once in `onReady` and leaked a connection to a
  disposed dock, whose error stopped the new one. Both docks now connect in an effect per dock
  (`DocumentDock.tsx`, `ModuleDock.tsx`), so any re-run connects again.
- Checked in the running app (my instance, a scratch repository): the window's big and small
  icons read back with `WM_GETICON` before and after switching (golden 48 and 24 px at 150 %,
  then vibrant), a Log task window opened with the vibrant icon, choosing Golden in Settings
  switched back; the Settings button worked after a reload and after a forced hot reload.

Slice 2 done (2026-11-17): window places and graph filters remembered.

- The main window opens where it was closed: position, size and maximized
  (`src-tauri/src/windows/placement/`, `window-state.json` in the config folder). A place
  less than 120 × 40 px of whose top would be on a screen's work area (a monitor unplugged) is
  ignored; a bigger one than its screen is shrunk and moved onto it. Each kind of task window
  opens at the size it last had, centred. Places are physical pixels; the size kept for a
  maximized window is the one before it was maximized.
- A window that was maximized is shown first and maximized after: maximizing it while hidden
  made Windows restore it to where it was built (tao moves windows asynchronously).
- Each repository's graph filter in the main window is saved when it changes
  (`repository/saved_filters.rs`, `graph-filters.json`, 200 repositories at most) and set
  before the graph is first built when the repository opens there again. Task windows' filters
  (a Log window on a folder) are neither saved nor restored.
- Checked in the running app: a moved and resized window reopened at the same place; a height
  far beyond the screen (from a broken test script) was shrunk to the work area; a maximized
  window reopened maximized and restored down to its saved place (the first try restored to the
  centre: fixed above); a Commit window reopened at its saved size, centred; First parent
  stayed on after a reload, Clear removed the saved entry, and a Log window on `src` saved
  nothing.

- [ ] Third-party licence notices shipped with the installers (for example generated with
      `cargo-about` and a JS equivalent). The grammars ask for theirs: two-face lists them
      (`two_face::acknowledgement::listing()`)
- [x] A second app icon, chosen in Settings (slice 1)
- [~] Final logo: the owner's painted finch and songbird are in (2026-10-29), and the vibrant
  variant's Windows icon (2026-11-17). Still to do: refined finch-on-a-branch artwork, small-size variants (16/24/32 px), monochrome version for the macOS menu bar and Linux symbolic icons, installer and website artwork
- [ ] Keyboard shortcuts everywhere; accessibility pass (focus, ARIA, contrast)
- [x] Remember window sizes and filters (open tabs and layout are restored from M2.5; slice 2)
- [ ] E2E smoke tests: open repo, browse graph, commit, branch, merge — ADR 0016
- [ ] Release workflow: build, sign, notarize installers for all platforms
- [ ] Auto-update with the Tauri updater plugin — ADR 0017
- [ ] `docs/development/release.md` finalized

## Phase 2: shell integration

Thin native add-ons that only build a command line and launch `noblame`. ADR 0018.

### T1: Windows Explorer

- [ ] `IExplorerCommand` COM extension (Rust `windows` crate or C++): submenu with Commit, Log, Diff, Blame, Pull, Push, Fetch, Switch, Merge, Rebase, Stash, Revert, Resolve, Add, Ignore, Clone, Create repository here
- [ ] Windows 11 top-level menu through package identity (sparse package or MSIX); classic menu fallback
- [ ] Entries depend on context (inside a repo or not, file vs. folder, conflicted file)
- [ ] **Open in NoBlame** on folders (owner request 2026-11-02), shown only when the folder
      holds a `.git` (the extension checks in `GetState`; a classic registry verb cannot)
- [ ] Installer option "Explorer integration"

### T2: macOS Finder

- [ ] Finder Sync extension (Swift) inside the app bundle: menu entries, signed and notarized;
      **Open in NoBlame** on repository folders
- [ ] First-run guidance for enabling the extension in System Settings

### T3: Linux file managers

- [ ] Nautilus (nautilus-python), Dolphin (service menus), Nemo (actions), Thunar (custom actions);
      **Open in NoBlame** on folders, only on repositories where the file manager can check
- [ ] Packaged with .deb/.rpm; AppImage documents a manual install

### T4: Status cache and overlays (optional)

- [ ] Background status service (reuses `git-core`): watches open repos, answers "status of path" in microseconds — ADR 0019
- [ ] Windows overlay icons (shared slot limit documented), Finder badges, Nautilus emblems
- [ ] Settings: which drives/folders to watch, on/off

## Ideas backlog (not scheduled)

Move an item into a milestone when it is picked up.

The owner's idea inbox (with where each idea is planned) is in
[design/workbench.md](design/workbench.md#ideas-inbox).

- [ ] Pop out any dock panel into its own window (second monitor)

- [ ] GitHub / GitLab / Azure DevOps / Bitbucket: pull requests, CI status on commits
- [ ] Graph minimap and "branch focus" (dim everything not reachable from selected branches)
- [ ] Repository statistics (commits per author over time, churn, hot files)
- [ ] Git-flow / trunk-based helpers
- [ ] Partial clone and sparse-checkout management
- [ ] Undo for the last operation (reflog-based)
- [ ] Optional AI commit message suggestions with the user's own API key
- [ ] Bundled portable git as an option for machines without git
- [ ] Plugin API

## ADR plan

| ADR  | Topic                                                               | Milestone | Status   |
| ---- | ------------------------------------------------------------------- | --------- | -------- |
| 0001 | Tauri 2 as the desktop shell                                        | M1        | Accepted |
| 0002 | Rust owns all Git access; the webview never touches the repo        | M1        | Accepted |
| 0003 | tauri-specta for typed IPC                                          | M1        | Accepted |
| 0004 | Frontend stack (React, TanStack Query, Zustand, shadcn/ui)          | M1        | Accepted |
| 0005 | Code organization (workspace, feature folders, modules)             | M1        | Accepted |
| 0006 | Error model (`AppError { code, message, hint }`)                    | M1        | Accepted |
| 0007 | Git engine: gix for reads, git CLI for writes; minimum git version  | M1        | Accepted |
| 0008 | Binary graph blocks on demand (was: stream over channels)           | M2        | Accepted |
| 0009 | Canvas graph rendering and lane layout                              | M2        | Accepted |
| 0010 | On-disk graph cache (commit index reused and cached)                | M2        | Accepted |
| 0011 | Background job model                                                | M5        | Accepted |
| 0012 | Credentials and askpass                                             | M5        | Accepted |
| 0013 | Diff viewer: diffs computed in Rust, rows paged                     | M3        | Accepted |
| 0014 | Conflict resolution UI                                              | M6        | Accepted |
| 0015 | CLI, single instance and task windows                               | M1        | Accepted |
| 0016 | Testing strategy                                                    | M9        | Planned  |
| 0017 | Auto-update via the Tauri updater                                   | M9        | Planned  |
| 0018 | Shell integration architecture                                      | T1        | Planned  |
| 0019 | Status cache service and overlays                                   | T4        | Planned  |
| 0020 | Workbench layout: activity bar, side panel modules, docking library | M2.5      | Accepted |
| 0021 | Graph filters as views of the loaded graph                          | M3        | Accepted |

## Working agreement

1. Vertical slices: backend → IPC → UI → tests → docs → changelog.
2. At the start of a milestone, list its slices here; after each slice, record a dated "Where
   we left off" note: what was built, what was verified in the real app, what was fixed.
3. After each milestone: lint, type-check and tests pass; `CLAUDE.md`, `docs/` and
   `CHANGELOG.md` updated; this file's checkboxes updated; summary of done/next.
4. Performance is verified on a large repo for every feature that touches history or status.
5. Small Conventional Commits.
6. Ambiguity → choose what a senior engineer would, record it in docs/ADR, continue. Stop to
   ask only for decisions that are expensive to reverse.
7. No faked features: stubs are labelled in the UI, docs and changelog.
