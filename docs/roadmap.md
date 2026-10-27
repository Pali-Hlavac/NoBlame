# Roadmap and plan

This is the delivery plan for NoBlame (drafted 2026-10-27). It is a living document: milestones,
scope and order may change, and slices are added at the start of each milestone. The product
requirements are in [project-brief.md](project-brief.md); where this plan differs, this plan
wins. Every milestone ends with a runnable, tested app, updated docs and a CHANGELOG entry.

Legend: `[x]` done · `[ ]` to do · `[~]` partially done / deferred (see note)

## Agreed product decisions

| Decision        | Detail                                                                                                                                                                                                                                                                                                                          |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Name            | **NoBlame** (CLI and binary: `noblame`). Chosen without "Git" in it because the Git trademark policy does not allow "Git" as part of a new product name; describe it as "a Git client" or "NoBlame for Git". Defined in one place (`src/app.config.ts` + `tauri.conf.json` `productName`), kept in sync by a test.              |
| Logo            | A **finch on a branch** (the branch doubles as a Git branch line). Simple, flat and readable at 16 px; works on light and dark backgrounds; one master SVG in `assets/logo/` from which all platform icons are generated (`pnpm tauri icon`). Must not use or resemble the Git logo (also covered by the Git trademark policy). |
| Two phases      | Phase 1: the main app (Git Extensions-style). Phase 2: shell integration (TortoiseGit-style context menus, overlays). Phase 2 starts only when phase 1 is good enough for daily use.                                                                                                                                            |
| Stack           | Tauri 2 + Rust; React + TypeScript + Vite + Tailwind 4 + shadcn/ui; TanStack Query + Zustand; `tauri-specta` (same stack as RipeMongo).                                                                                                                                                                                         |
| Git engine      | Reads with `gix` (gitoxide); writes and network through the installed `git` CLI. ADR 0007.                                                                                                                                                                                                                                      |
| Git requirement | The user's own `git` is required (not bundled in v1). Minimum version **2.39.0** (ADR 0007; revised from the tentative 2.40 because Debian 12 and Apple's Xcode CLT ship 2.39.x). The app detects it and explains how to install or upgrade.                                                                                    |
| Commit graph    | Lane layout in Rust, binary row batches over Tauri channels, virtualized canvas rendering, on-disk graph cache per repo. ADRs 0008-0010.                                                                                                                                                                                        |
| Entry points    | CLI (`noblame <command> <path>`), single instance, task windows. Built from M1. ADR 0015.                                                                                                                                                                                                                                       |
| Platforms       | Windows 10/11 x64 (+ arm64 later), macOS 12+ (universal), Linux x64 (AppImage, .deb, .rpm).                                                                                                                                                                                                                                     |
| E2E tests       | WebdriverIO + `tauri-driver` on Linux/Windows; no macOS E2E.                                                                                                                                                                                                                                                                    |

### Performance targets (first guesses, to be measured and revised in M2)

| Scenario (reference: Linux kernel, ~1.3M commits) | Target                               |
| ------------------------------------------------- | ------------------------------------ |
| First rows of the graph visible, first open       | < 1 s                                |
| First rows visible, reopening (cache warm)        | < 300 ms                             |
| Whole history indexed in the background           | < 30 s, UI responsive throughout     |
| Scrolling the graph                               | 60 fps, no blank rows on fast scroll |
| Memory for the graph index                        | < 200 bytes per commit               |
| Working tree status, 100k files (fsmonitor on)    | < 1 s                                |

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

- [ ] Open / init / recent repositories (dashboard), several repos in tabs, detect bare/worktree/submodule
- [ ] Spike first: history walk with `gix` + commit-graph file on a 1M-commit repo, measured
- [ ] Lane layout in Rust (incremental, stable lane colors, merge/fork edges, octopus merges)
- [ ] Streaming binary row batches over Tauri channels; format documented in `docs/architecture/ipc.md`
- [ ] Virtualized canvas graph: row heights, HiDPI, selection, keyboard navigation, 60 fps
- [ ] Columns: graph, message, author, date, hash; ref labels (branches, remotes, tags, HEAD, stash)
- [ ] "Artificial" rows for working tree and index changes at the top (as Git Extensions does)
- [ ] Offer to write the commit-graph file (`--changed-paths`) when missing
- [ ] On-disk graph cache per repo; incremental update after fetch/commit — ADR 0010
- [ ] File watcher (debounced) refreshing refs and status
- [ ] Benchmarks recorded in `docs/development/performance.md`; targets revised

### M3: Inspecting history

- [ ] Commit details: message, author/committer, parents, children, refs containing it, signature status
- [ ] Diff viewer: unified and side-by-side, virtualized for huge diffs, syntax highlighting, whitespace options, word diff, image and binary handling — ADR 0013
- [ ] Changed files list and file tree of any revision; open/save a file at a revision
- [ ] File history (following renames) and blame with "blame previous revision"
- [ ] Filters: branch(es), author, committer, message, path, date range, first-parent only, hide merges
- [ ] Find in the graph (hash, message, ref) with jump-to; "go to commit"
- [ ] Compare any two commits/branches

### M4: Working copy and committing

- [ ] Status: staged, unstaged, untracked, conflicted; fast on large trees (`--no-optional-locks`, fsmonitor, untracked cache)
- [ ] Stage/unstage files, hunks and single lines; discard changes (with confirmation)
- [ ] Commit dialog: message editor with templates, amend, sign-off, GPG/SSH signing via git, author override, hooks output shown
- [ ] Commit message history and recent-message reuse
- [ ] Stash: create (incl. untracked, keep index), list, show, apply, pop, drop
- [ ] `.gitignore` helper: ignore file/extension/folder from the status list

### M5: Branches, tags and remotes

- [ ] Branches and tags: create, rename, delete (unmerged warning), checkout/switch, track upstream
- [ ] Ahead/behind counts per branch; sidebar with branches, remotes, tags, stashes, submodules, worktrees
- [ ] Fetch, pull (merge/rebase/ff-only), push (incl. tags, force-with-lease behind confirmation) as background jobs with progress
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

- [ ] Submodules: status, init/update, open as a repo tab, diff of submodule pointers
- [ ] Worktrees: list, add, remove, open
- [ ] Git LFS: detect, show pointers vs. content, lock/unlock
- [ ] Bisect workflow (good/bad/skip from the graph)
- [ ] Patches: create (format-patch), apply (am/apply); archive a revision
- [ ] User scripts / custom commands with placeholders (`{sha}`, `{branch}`, `{file}`) like Git Extensions scripts
- [ ] Settings: repo and global git config editor (explicit), app preferences, keyboard shortcuts

### M8: Standalone task windows (prepares phase 2)

- [ ] `noblame log|commit|diff|blame|filehistory|pull|push|fetch|switch|merge|rebase|stash|clone|init <path>` open focused windows
- [ ] Path-scoped views: log and status limited to a folder or file
- [ ] Windows reuse the running instance; closing the last task window exits when the main window is not open
- [ ] Documented CLI reference (`docs/features/cli.md`), `--help` output tested

### M9: Polish and release

- [ ] Final logo: refined finch-on-a-branch artwork, small-size variants (16/24/32 px), monochrome version for the macOS menu bar and Linux symbolic icons, installer and website artwork
- [ ] Keyboard shortcuts everywhere; accessibility pass (focus, ARIA, contrast)
- [ ] Remember window sizes, open repo tabs, layout and filters
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

| ADR  | Topic                                                              | Milestone | Status   |
| ---- | ------------------------------------------------------------------ | --------- | -------- |
| 0001 | Tauri 2 as the desktop shell                                       | M1        | Accepted |
| 0002 | Rust owns all Git access; the webview never touches the repo       | M1        | Accepted |
| 0003 | tauri-specta for typed IPC                                         | M1        | Accepted |
| 0004 | Frontend stack (React, TanStack Query, Zustand, shadcn/ui)         | M1        | Accepted |
| 0005 | Code organization (workspace, feature folders, modules)            | M1        | Accepted |
| 0006 | Error model (`AppError { code, message, hint }`)                   | M1        | Accepted |
| 0007 | Git engine: gix for reads, git CLI for writes; minimum git version | M1        | Accepted |
| 0008 | Binary commit stream over Tauri channels                           | M2        | Planned  |
| 0009 | Canvas graph rendering and lane layout                             | M2        | Planned  |
| 0010 | On-disk graph cache                                                | M2        | Planned  |
| 0011 | Background job model                                               | M5        | Planned  |
| 0012 | Credentials and askpass                                            | M5        | Planned  |
| 0013 | Diff viewer implementation                                         | M3        | Planned  |
| 0014 | Conflict resolution UI                                             | M6        | Planned  |
| 0015 | CLI, single instance and task windows                              | M1        | Accepted |
| 0016 | Testing strategy                                                   | M9        | Planned  |
| 0017 | Auto-update via the Tauri updater                                  | M9        | Planned  |
| 0018 | Shell integration architecture                                     | T1        | Planned  |
| 0019 | Status cache service and overlays                                  | T4        | Planned  |

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
