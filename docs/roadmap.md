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
| Working tree status, 100k files (fsmonitor on) | < 1 s                                | 170 ms for 40,000 files; 100k not measured yet                        |

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
- [~] Columns: graph, message, author, date, hash; ref labels for branches, remotes, tags and
  HEAD done. Stash label moved to M4 (stash list).
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

- [ ] Commit details module, complete: children, signature status (the basics are in M2.5)
- [x] Changed files module for the selected commit (list, renames, merge parents); selecting
      a file shows it in the single diff tab, which switches files in place and stays where it is
      docked (several diff tabs: later)
- [x] Diff viewer (ADR 0013): unified and side by side, virtualized and paged for huge diffs,
      whitespace options, context lines, word diff, syntax highlighting, image previews, binary
      detection with `.gitattributes`
- [ ] Changed files list and file tree of any revision; open/save a file at a revision
- [ ] File history (following renames) and blame with "blame previous revision"
- [x] Filters: branch(es), author, committer, message, path, date range, first-parent only, hide merges
      (owner request 2026-10-28: show only a branch, only an author, changes to a file, and a
      general search in messages). Done (ADR 0021): one branch or HEAD, first parent, no merges,
      message, author and path (slices 4a–4c)
- [ ] Filters, later: committer, date range, several branches at once, regular expressions
- [ ] Find in the graph (hash, message, ref) with jump-to; "go to commit"
- [ ] Compare any two commits/branches

Slices, in order (planned 2026-10-28):

1. **Changed files** module: the files the selected commit changed (against its first parent;
   merges and other parents later), with status and renames; gix tree diff.
2. **Diff tab**: one tab in the main dock showing the selected file's unified diff, virtualized,
   switching files in place. ADR 0013.
3. Side-by-side view, whitespace options, word diff, syntax highlighting, images and binaries.
4. **Filters** in the repository tab (owner request): one branch, one author, changes to a path,
   search in messages; first-parent and hide merges.
5. Find in the graph and "go to commit".
6. File tree of a revision; open or save a file at a revision.
7. File history (following renames) and blame.
8. Compare two commits or branches.
9. Commit details: children and signature status.

### M4: Working copy and committing

- [ ] Status: staged, unstaged, untracked, conflicted; fast on large trees (`--no-optional-locks`, fsmonitor, untracked cache)
- [ ] Stage/unstage files, hunks and single lines; discard changes (with confirmation)
- [ ] Commit dialog: message editor with templates, amend, sign-off, GPG/SSH signing via git, author override, hooks output shown
- [ ] Commit window as a modal dialog or as a module in the left dock; a setting picks one (owner
      request 2026-10-28)
- [ ] Commit message history and recent-message reuse
- [ ] Stash: create from selected files (checkbox list, message, keep index, include untracked),
      list (Stashes module), show (files and diffs in the dock), apply/pop a whole stash or only
      selected files, drop with confirmation; stash label in the graph
- [ ] `.gitignore` helper: ignore file/extension/folder from the status list

### M5: Branches, tags and remotes

- [ ] Branches and tags: create, rename, delete (unmerged warning), checkout/switch, track upstream
- [ ] Ahead/behind counts per branch; actions in the Branches module (checkout, create, rename,
      delete, track); Submodules and Worktrees modules
- [ ] Toolbar operations: Fetch, Fetch all, Fetch and prune (`git fetch --prune`), Pull
      (merge/rebase/ff-only), Push (incl. tags, force-with-lease behind confirmation) as background
      jobs with progress
- [ ] Quick Pull button on repository rows in the Repositories module, behind a setting (owner
      request 2026-10-28; quick Merge follows with merging in M6); the "…" menu's Pull, Fetch and
      Push become real
- [ ] Credentials: git credential helpers; `GIT_ASKPASS`/`SSH_ASKPASS` helper that asks in the app — ADR 0012
- [ ] Manage remotes; clone dialog (shallow, single branch, partial clone, recursive submodules)
- [ ] Background job registry: progress, cancel, logs, "equivalent command" shown — ADR 0011

### M6: Changing history and resolving conflicts

- [ ] Merge (ff/no-ff/squash), rebase, cherry-pick, revert, reset (soft/mixed/hard behind confirmation)
- [ ] Interactive rebase editor: reorder, squash, fixup, reword, edit, drop; autosquash
- [ ] In-progress operation banner (merge/rebase/cherry-pick/bisect) with continue/skip/abort
- [ ] Conflict resolution: list, ours/theirs, built-in three-way merge view — ADR 0014
- [ ] External diff and merge tools (configured like Git Extensions, honoring `diff.tool`/`merge.tool`)
- [ ] Reflog browser with "restore this state"

### M7: Advanced Git

- [ ] Submodules: status, init/update, diff of submodule pointers (listing and opening them is in
      the M2.5 Repositories module)
- [ ] Worktrees: list, add, remove, open
- [ ] Git LFS: detect, show pointers vs. content, lock/unlock
- [ ] Bisect workflow (good/bad/skip from the graph)
- [ ] Patches: create (format-patch), apply (am/apply); archive a revision
- [ ] User scripts / custom commands with placeholders (`{sha}`, `{branch}`, `{file}`) like Git Extensions scripts
- [ ] Settings: repo and global git config editor (explicit), app preferences, keyboard shortcuts
      (configurable in the Settings tab, owner request 2026-10-28; first move every shortcut into
      one keybinding registry, since features register their own today)

### M8: Standalone task windows (prepares phase 2)

- [ ] `noblame log|commit|diff|blame|filehistory|pull|push|fetch|switch|merge|rebase|stash|clone|init <path>` open focused windows
- [ ] Path-scoped views: log and status limited to a folder or file
- [ ] Windows reuse the running instance; closing the last task window exits when the main window is not open
- [ ] Documented CLI reference (`docs/features/cli.md`), `--help` output tested

### M9: Polish and release

- [ ] Third-party licence notices shipped with the installers (for example generated with
      `cargo-about` and a JS equivalent): the bundled Sublime Text grammars ask for theirs
- [~] Final logo: the owner's painted finch and songbird are in (2026-10-29). Still to do: refined finch-on-a-branch artwork, small-size variants (16/24/32 px), monochrome version for the macOS menu bar and Linux symbolic icons, installer and website artwork
- [ ] Keyboard shortcuts everywhere; accessibility pass (focus, ARIA, contrast)
- [ ] Remember window sizes and filters (open tabs and layout are restored from M2.5)
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
- [ ] Installer option "Explorer integration"

### T2: macOS Finder

- [ ] Finder Sync extension (Swift) inside the app bundle: menu entries, signed and notarized
- [ ] First-run guidance for enabling the extension in System Settings

### T3: Linux file managers

- [ ] Nautilus (nautilus-python), Dolphin (service menus), Nemo (actions), Thunar (custom actions)
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
| 0011 | Background job model                                                | M5        | Planned  |
| 0012 | Credentials and askpass                                             | M5        | Planned  |
| 0013 | Diff viewer: diffs computed in Rust, rows paged                     | M3        | Accepted |
| 0014 | Conflict resolution UI                                              | M6        | Planned  |
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
