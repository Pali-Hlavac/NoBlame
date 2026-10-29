# CLAUDE.md

## Project overview

NoBlame is a cross-platform desktop Git client for Windows, Linux and macOS.
Phase 1 is a full Git GUI inspired by Git Extensions. Phase 2 adds TortoiseGit-style
file-manager context menus that launch the app's task windows. It must stay fast on giant
repositories (hundreds of thousands of commits, thousands of refs, huge working trees).
Built with Tauri 2 (Rust) and React + TypeScript. Plan and status:
[docs/roadmap.md](docs/roadmap.md); requirements: [docs/project-brief.md](docs/project-brief.md).

> Status: M1, M2 and M2.5 done (graph, working tree rows, watcher, index cache; measured on the
> Linux kernel). M3 in progress: Changed files and the diff tab done (unified and side by side,
> word diff, syntax colours, images) and graph filters (branch, first parent, no merges,
> message, author, path; views of the graph, ADR 0021). Next: find in the graph. Parts marked _(later)_ below are
> planned and do not exist yet.

## Architecture

```
React feature component
  → feature api hook (TanStack Query)            src/features/<f>/api/*.ts
  → typed client: unwrap(commands.x())           src/shared/ipc/client.ts + generated bindings.ts
  ══ Tauri IPC (JSON commands, ACL-checked) ══    + raw-bytes results for graph blocks
  → #[tauri::command] in <module>/commands.rs    thin: extract State, call service, map error
  → <module>/service.rs                          app logic (repo sessions, jobs, settings)
  → crates/git-core                              no Tauri: gix reads, git CLI writes, graph layout
  ← Result<T, DomainError> → From<DomainError> for AppError → { code, message, hint }
  ← client throws IpcError → ErrorState / toast
```

- **Only Rust touches repositories.** The webview never reads `.git` or runs processes.
- **Reads with `gix`, writes with the `git` CLI.** History, refs, trees, diffs, blame and
  status use `gix`. Commit, merge, rebase, stash, fetch/pull/push run the user's `git` so
  hooks, credential helpers, signing, LFS and config behave as expected. See
  [docs/architecture/git-engine.md](docs/architecture/git-engine.md).
- **Commit graph**: walked and laid out in `git-core::graph` (checkpoint every 256 rows),
  fetched by the UI as binary blocks on demand (`get_graph_block`), drawn on a virtualized
  canvas; text columns are paged (`get_commit_rows`). The commit index is reused between builds
  and cached on disk (`graph-cache/*.nbci`, ADR 0010). See
  [docs/architecture/commit-graph.md](docs/architecture/commit-graph.md).
- **Types are generated**: Rust types deriving `specta::Type` and commands listed in
  `src-tauri/src/ipc.rs` are exported to `src/shared/ipc/bindings.ts` (`pnpm bindings`).
- **Background jobs**: fetch, push, clone and long rebases run as cancellable jobs with
  progress (parsed from `--progress`) and logs, delivered as typed events.
- **Entry points**: `noblame <command> <path>` is parsed in Rust (`clap`). A second launch
  forwards its arguments to the running instance, which opens a task window. Phase 2 shell
  add-ons only build these command lines.

## Directory map

| Path                         | What lives there                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `crates/git-core/`           | Git engine, no Tauri. `cli/` (safe `GitCommand`), `diff/` (changed files, file diffs and rows), `repo/` (open with gix), `graph/` (index, order, layout, blocks, details, contained-in, ancestry, filters and views), `stash.rs`, `status.rs` (summary via `git status`), `submodule.rs`, `watch.rs` (notify, debounced, gitignore-filtered). _(later: `blame/`)_ |
| `crates/git-core/tests/`     | Integration tests (`support/` fixture builder) against the real `git`; `benches/graph.rs`; `examples/graph_spike.rs`                                                                                                                                                                                                                                              |
| `crates/repo-gen/`           | Synthetic repo generator (lib + `noblame-repo-gen` binary): fast-import stream, presets tiny…1m                                                                                                                                                                                                                                                                   |
| `src-tauri/src/<module>/`    | Tauri-side module: `mod.rs commands.rs service.rs error.rs types.rs` (`app_info git_env inspect repository settings windows workbench`)                                                                                                                                                                                                                           |
| `src-tauri/src/cli/`         | `clap` command line built from `TaskKind::ALL`; console attach for `--help` on Windows                                                                                                                                                                                                                                                                            |
| `src-tauri/src/windows/`     | Main/task windows, `WindowRegistry`, second-launch forwarding, `RepositoriesRequested` event                                                                                                                                                                                                                                                                      |
| `src-tauri/src/ipc.rs`       | Command + event registry, bindings export                                                                                                                                                                                                                                                                                                                         |
| `src-tauri/src/error.rs`     | `AppError { code, message, hint }`, `ErrorCode`                                                                                                                                                                                                                                                                                                                   |
| `src-tauri/build.rs`         | `APP_COMMANDS` (ACL permissions); Windows manifest for test binaries                                                                                                                                                                                                                                                                                              |
| `src-tauri/capabilities/`    | ACL per window: `main.json` (`main`), `task.json` (`task-*`)                                                                                                                                                                                                                                                                                                      |
| `src/app/`                   | App shell: `App.tsx`, `layout/` (main window, toolbar, status bar), `workbench/modules.ts` (module registry), `commands/` (palette)                                                                                                                                                                                                                               |
| `src/features/<feature>/`    | `about branches changed-files command-palette commit-details diff git-env graph repositories selection settings stashes windows workbench working-tree workspace`; public `index.ts` each                                                                                                                                                                         |
| `src/features/window-frame/` | Custom title bar and window buttons of the main window                                                                                                                                                                                                                                                                                                            |
| `src/features/workbench/`    | Activity bar, module dock + document dock (dockview), toolbar renderer, layout save/restore, F6 regions (ADR 0020)                                                                                                                                                                                                                                                |
| `src/features/graph/`        | Canvas renderer, block decoder and LRU cache, scroll scaling, keyboard navigation                                                                                                                                                                                                                                                                                 |
| `src/shared/ipc/`            | Generated `bindings.ts` + typed client (`unwrap`, `call`, `IpcError`)                                                                                                                                                                                                                                                                                             |
| `src/shared/ui/`             | shadcn/ui primitives                                                                                                                                                                                                                                                                                                                                              |
| `src/shared/components/`     | `EmptyState`, `ErrorState`, `LoadingState`, `ConfirmDialog`, `InlineError`, `VirtualList`                                                                                                                                                                                                                                                                         |
| `assets/logo/`               | Master logo `noblame.png` (1024 px), hand-made `noblame.ico`, transparent `songbird.png`; `pnpm icons` generates `src-tauri/icons/` and `public/icon.png`; `public/songbird.png` (320 px) is the UI logo                                                                                                                                                          |
| `scripts/`                   | Repo tooling: `check-file-size.mjs`                                                                                                                                                                                                                                                                                                                               |
| `docs/`                      | All documentation; start at `docs/README.md`                                                                                                                                                                                                                                                                                                                      |
| `shell/`                     | _(Phase 2)_ Explorer, Finder and Linux file-manager add-ons                                                                                                                                                                                                                                                                                                       |

## Conventions

- **File size**: soft limit 200 lines, hard limit 300 (enforced by `pnpm lint`). Split early.
- **Naming**: components `PascalCase.tsx`; hooks `useThing.ts`; other TS `camelCase.ts`; Rust
  `snake_case`. Commands are verbs: `get_commit`, `stage_hunks`.
- **TypeScript**: strict, no `any`, no `!` without a comment, `import type` for types.
- **Rust**: no `unwrap`/`expect` outside tests (clippy enforces); `///` docs on public items;
  `//!` header on every non-trivial file. `git-core` must never depend on Tauri.
- **No magic numbers**: name constants (`GRAPH_BATCH_SIZE`, `ROW_HEIGHT_PX`, ...).
- **Feature boundaries**: import other features only through their `index.ts`.
- **State**: backend data → TanStack Query in `api/`; UI-only state → Zustand in `store/`;
  never copy query data into Zustand. Graph rows live outside React state (typed arrays).
- **Workbench**: modules are registered in `src/app/workbench/modules.ts` and never know where
  they are docked. They read the active repository (`useActiveRepository` /
  `WithActiveRepository`) and the selection (`features/selection`). Toolbar buttons are data
  (`ToolbarAction`), and stubs name their milestone. See `docs/features/workbench.md`.
- **Styling**: Tailwind utilities + tokens from `src/app/styles.css`; `cn()`; no inline colors.
  Every interactive element has a visible focus state and an accessible name.
- **Dangerous actions** (reset --hard, force push, delete unmerged branch, discard, clean,
  drop stash) use a confirmation dialog that names exactly what will be lost.

### Running git safely

- Always argument arrays through `git_core::cli::GitCommand`, never a shell string.
- Put `--` before paths; reject refnames and paths that would be read as options.
- `arg()` takes only `&'static str`; user/repo values go through `option("--name", v)`,
  `revision(r)?` or `paths(..)`. Read-only commands call `.read_only()`.
- `GitCommand` already sets `LC_ALL=C`, `GIT_TERMINAL_PROMPT=0`, `-c core.quotepath=false
-c color.ui=false`, clears `GIT_DIR`/`GIT_WORK_TREE`/..., hides the console window. Parse
  `-z` / `--porcelain=v2` / NUL-separated `--format` output, keep it as bytes.
- Never change global/system git config or run `gc`/`prune` unless the user asks.

### Adding a Tauri command end to end

1. Implement Git logic in `crates/git-core` with tests against a fixture repo.
2. Wire it in `src-tauri/src/<module>/service.rs`; add a `#[tauri::command] #[specta::specta]`
   fn in `commands.rs` returning `CommandResult<T>`; add `impl From<ModuleError> for AppError`.
3. Register it in `collect_commands![]` in `src-tauri/src/ipc.rs`.
4. Add its name to `APP_COMMANDS` in `src-tauri/build.rs`.
5. Grant `allow-<kebab-name>` in `src-tauri/capabilities/*.json` (every window that needs it).
6. `pnpm bindings`; call it from a feature `api/` hook via `unwrap(commands.x(...))`.
7. Document it in `docs/architecture/ipc.md` and the feature doc.

## Commands

| Task                          | Command                                                                                   |
| ----------------------------- | ----------------------------------------------------------------------------------------- |
| Install                       | `pnpm install`                                                                            |
| Run the desktop app (dev)     | `pnpm app:dev`                                                                            |
| Run with arguments (dev)      | `pnpm app:dev -- -- log <path>`                                                           |
| Build installers              | `pnpm app:build`                                                                          |
| Frontend tests                | `pnpm test` (watch: `pnpm test:watch`)                                                    |
| Rust tests                    | `pnpm test:rust`                                                                          |
| Lint (TS + file sizes) / Rust | `pnpm lint` / `pnpm lint:rust`                                                            |
| Type-check                    | `pnpm typecheck`                                                                          |
| Format / check formatting     | `pnpm format` / `pnpm format:check`                                                       |
| Regenerate IPC bindings       | `pnpm bindings`                                                                           |
| Generate synthetic repos      | `pnpm repos:generate [--preset 10k 100k 1m]` (into `.cache/repos/`, git-ignored)          |
| Regenerate app icons          | `pnpm icons` (from `assets/logo/noblame.png` and `noblame.ico`)                           |
| Benchmarks                    | `pnpm bench` (graph build; 100k/1m when generated, see `docs/development/performance.md`) |
| Graph timing on any repo      | `cargo run --release -p git-core --example graph_spike -- <repo>`                         |
| File diff timing              | `cargo run --release -p git-core --example diff_spike -- <repo> <old-blob> <new-blob>`    |
| Everything CI runs            | `pnpm check`                                                                              |

## Gotchas

- **Big integers**: specta refuses `i64/u64` in exported types. Commit times go as `f64`
  seconds; exact values (sizes, ids) as strings.
- **Large payloads**: never send thousands of commits as JSON commands; use the binary
  graph channel. Diffs and blame are paged.
- **Tauri sync commands run on the main thread**: make any command doing I/O `async`;
  CPU-heavy work goes to `spawn_blocking` or a dedicated thread.
- **Paths and messages are bytes**: `gix` uses `BString`; non-UTF-8 is legal in Git. Convert
  lossily only for display, never for round-trips back to git.
- **Windows**: long paths (`core.longpaths`), CRLF/autocrlf, case-insensitive paths, no
  console window for spawned `git` (`CREATE_NO_WINDOW`).
- **macOS**: Unicode normalization of file names (`core.precomposeunicode`); GUI apps get a
  minimal `PATH`, so locate `git` explicitly (Homebrew, Xcode CLT).
- **Untrusted repos**: config like `core.fsmonitor` and hooks can run programs. Respect
  `safe.directory`, never override it, and say why a repo was refused.
- **Bindings**: never edit `bindings.ts`; it is excluded from ESLint/Prettier on purpose.
  Debug app runs also regenerate it.
- **New command returns "not allowed"**: step 4 or 5 of "Adding a Tauri command" is missing.
- **Windows are created in Rust** (`tauri.conf.json` has `"windows": []`), and only from the
  setup hook, the single-instance callback or `async` commands: a sync command deadlocks on
  Windows. A window learns its purpose via `get_window_context`.
- **Requests travel as data-less events**: the main window drains `take_repository_requests` on
  start and on `RepositoriesRequested`, so early requests are not lost. Keep that pattern for
  anything that must not be lost; notifications such as `RepositoryChanged` may carry data.
- **Graph rows change meaning on reload**: anything keyed by row must include
  `GraphSummary.generation` or be refetched (`reloadGraph` in `features/graph/api/reload.ts`).
- **Hot reload keeps old event listeners**: an edited module used by a `listen()` callback keeps
  running its old code until the page reloads; reload before testing event handling.
- **Cancelling git kills only the direct child**; on Windows a grandchild holding the pipe also
  keeps a Tokio blocking thread until it exits. Process-tree kill comes with jobs (M5).
- **Windows build "Access is denied"** running build scripts: Defender/Smart App Control;
  exclude the repo folder. Test binaries need the manifest embedded by `build.rs`.
- **Pinned versions**: `specta`/`tauri-specta` `=2.0.0-rc.26` + `specta-typescript =0.0.13`
  (upgrade together); `dockview-react`, `dockview`, `dockview-core` exactly `8.4.1` (overrides in
  `package.json`; upgrade together); TypeScript `~6.0` until typescript-eslint supports 7; jsdom 27 (jsdom 30
  needs Node ≥ 22.22).
- **cmdk ranks by `value`**: palette items use the visible label as `value`, never an id.
- **StrictMode runs effects twice in dev**: never drop the result of a destructive call (like
  `take_repository_requests`) in an effect cleanup.
- **`#[serde(default)]` structs become optional fields** in the bindings. Settings are read
  through `useAppSettings()` (`withDefaults`); add new settings to `DEFAULT_SETTINGS` too.
- **`f64` fields are `number | null`** in the bindings (serde writes NaN as null); handle null.
- **gix 0.90 has one error type** (`gix::Error`): branch on `error.classify()`
  (`is_not_found`, `is_permission_denied`), never on message text.
- **Repository sessions live as long as their tab**: the session query uses `gcTime: Infinity`
  and `useSessionCleanup` closes it; refetching would open a second backend session.
- **Windows keeps pack files of open repositories mapped**: stop the app before regenerating or
  deleting `.cache/repos/*`.
- **dockview `addPanel` without `position` opens a new group** beside the others. Always pass
  `position: { referenceGroup, direction: "within" }` (see `reconcile.ts`, `docks.ts`).
- **Windows are built with `disable_drag_drop_handler()`**: Tauri's file-drop handler swallows
  HTML drag and drop on Windows, and the docks drag tabs with it. Keep it on new windows.
- **The main window has no system frame** (macOS: overlay title bar). `TitleBar` draws the drag
  area (`data-tauri-drag-region` on each filler; children do not inherit it) and the window
  buttons; their `core:window:*` permissions are in `capabilities/main.json`.
- **react-resizable-panels re-registers a panel when `defaultSize` changes**: never feed live
  state into it (the splitter would reset on every drag step).
- **Containers sized by the layout must not scroll**: at fractional display scaling (150 %) a
  panel is e.g. 301.51 px wide while the dock inside lays out to whole pixels, so
  `overflow: auto` (react-resizable-panels' default) toggles scrollbars every frame. Panels get
  `overflow: hidden`; only the content inside scrolls.
- **The tabs store is the source of truth for open tabs**; dockview only holds where they are.
  Change tabs through `useTabsStore`, never with `api.addPanel` directly.
- **Saved layout shape changes**: bump `LAYOUT_VERSION` (`workbench/lib/layout.ts`); old layouts
  are then ignored. Module ids are stored in layouts: never rename or reuse one.
- **Linux** dev needs `libwebkit2gtk-4.1-dev` and friends (see `docs/getting-started.md`).

## Where to find more

- [docs/README.md](docs/README.md): index of all docs
- [docs/roadmap.md](docs/roadmap.md): milestones, scope checklists, agreed decisions
- [docs/architecture/](docs/architecture/): overview, IPC, git engine, commit graph, jobs,
  CLI and windows, security
- [docs/user-guide/](docs/user-guide/): plain-language guide for users
- [docs/features/](docs/features/): one file per user-facing feature
- [docs/adr/](docs/adr/): architecture decisions
- [docs/development/](docs/development/): standards, testing, performance, release, troubleshooting

## Rules for AI agents

1. Read this file, `docs/roadmap.md` and the relevant `docs/features/*.md` before changing code.
2. Follow the vertical slice order: git-core → service → IPC → UI → tests → docs → changelog.
3. Update the docs, the user guide (`docs/user-guide/`, plain language, no internals) and
   `CHANGELOG.md` (`[Unreleased]`) with every change; tick `docs/roadmap.md` when done.
4. Anything touching history, status or diffs is checked on a large repo; record numbers in
   `docs/development/performance.md` when they change.
5. Never commit secrets, generated test repos or downloaded benchmark repos.
6. Run `pnpm check` before declaring work done, and verify the change in the running app.
7. Don't fake features: stubs must be labelled in the UI, the docs and the changelog.
8. Don't copy code from GPL projects (Git Extensions, TortoiseGit); behaviour only.
9. Use Conventional Commits (`feat:`, `fix:`, `perf:`, `docs:`, `chore:`, ...).
