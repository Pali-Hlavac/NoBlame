# CLAUDE.md

## Project overview

NoBlame is a cross-platform desktop Git client for Windows, Linux and macOS.
Phase 1 is a full Git GUI inspired by Git Extensions. Phase 2 adds TortoiseGit-style
file-manager context menus that launch the app's task windows. It must stay fast on giant
repositories (hundreds of thousands of commits, thousands of refs, huge working trees).
Built with Tauri 2 (Rust) and React + TypeScript. Plan and status:
[docs/roadmap.md](docs/roadmap.md); requirements: [docs/project-brief.md](docs/project-brief.md).

> Status: M1 (scaffold, tooling, CI, docs) is done; next is M2 (open repositories, commit
> graph). Parts marked _(M2+)_ below are planned and do not exist yet.

## Architecture

```
React feature component
  → feature api hook (TanStack Query)            src/features/<f>/api/*.ts
  → typed client: unwrap(commands.x())           src/shared/ipc/client.ts + generated bindings.ts
  ══ Tauri IPC (JSON commands, ACL-checked) ══    + binary Channel for graph rows
  → #[tauri::command] in <module>/commands.rs    thin: extract State, call service, map error
  → <module>/service.rs                          app logic (repo sessions, jobs, settings)
  → crates/git-core                              no Tauri: gix reads, git CLI writes, graph layout, cache
  ← Result<T, DomainError> → From<DomainError> for AppError → { code, message, hint }
  ← client throws IpcError → ErrorState / toast
```

- **Only Rust touches repositories.** The webview never reads `.git` or runs processes.
- **Reads with `gix`, writes with the `git` CLI.** History, refs, trees, diffs, blame and
  status use `gix`. Commit, merge, rebase, stash, fetch/pull/push run the user's `git` so
  hooks, credential helpers, signing, LFS and config behave as expected. See
  [docs/architecture/git-engine.md](docs/architecture/git-engine.md).
- **Commit graph**: walked and laid out in `git-core::graph`, cached on disk per repo,
  streamed as binary batches over a Tauri `Channel`, drawn on a virtualized canvas. See
  [docs/architecture/commit-graph.md](docs/architecture/commit-graph.md).
- **Types are generated**: Rust types deriving `specta::Type` and commands listed in
  `src-tauri/src/ipc.rs` are exported to `src/shared/ipc/bindings.ts` (`pnpm bindings`).
- **Background jobs**: fetch, push, clone and long rebases run as cancellable jobs with
  progress (parsed from `--progress`) and logs, delivered as typed events.
- **Entry points**: `noblame <command> <path>` is parsed in Rust (`clap`). A second launch
  forwards its arguments to the running instance, which opens a task window. Phase 2 shell
  add-ons only build these command lines.

## Directory map

| Path                      | What lives there                                                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `crates/git-core/`        | Git engine, no Tauri. `cli/`: locate git, version, safe `GitCommand`, cancellable run. _(M2+: `repo/ graph/ diff/ blame/ status/ cache/`)_ |
| `crates/git-core/tests/`  | Integration tests against the real `git` and generated repos                                                                               |
| `crates/repo-gen/`        | Synthetic repo generator (lib + `noblame-repo-gen` binary): fast-import stream, presets tiny…1m                                            |
| `src-tauri/src/<module>/` | Tauri-side module: `mod.rs commands.rs service.rs error.rs types.rs` (`app_info git_env settings windows`)                                 |
| `src-tauri/src/cli/`      | `clap` command line built from `TaskKind::ALL`; console attach for `--help` on Windows                                                     |
| `src-tauri/src/windows/`  | Main/task windows, `WindowRegistry`, second-launch forwarding, `RepositoriesRequested` event                                               |
| `src-tauri/src/ipc.rs`    | Command + event registry, bindings export                                                                                                  |
| `src-tauri/src/error.rs`  | `AppError { code, message, hint }`, `ErrorCode`                                                                                            |
| `src-tauri/build.rs`      | `APP_COMMANDS` (ACL permissions); Windows manifest for test binaries                                                                       |
| `src-tauri/capabilities/` | ACL per window: `main.json` (`main`), `task.json` (`task-*`)                                                                               |
| `src/app/`                | App shell: `App.tsx` (window context switch), `layout/` (main window, status bar), `commands/` (palette)                                   |
| `src/features/<feature>/` | `about command-palette git-env repositories settings windows workspace`; public `index.ts` each                                            |
| `src/features/graph/`     | _(M2)_ Canvas renderer, binary batch decoder, virtualization                                                                               |
| `src/shared/ipc/`         | Generated `bindings.ts` + typed client (`unwrap`, `call`, `IpcError`)                                                                      |
| `src/shared/ui/`          | shadcn/ui primitives                                                                                                                       |
| `src/shared/components/`  | `EmptyState`, `ErrorState`, `LoadingState`, `ConfirmDialog`, `InlineError`                                                                 |
| `assets/logo/noblame.svg` | Master logo; `pnpm icons` generates `src-tauri/icons/`; copy to `public/icon.svg` for the UI                                               |
| `scripts/`                | Repo tooling: `check-file-size.mjs`                                                                                                        |
| `docs/`                   | All documentation; start at `docs/README.md`                                                                                               |
| `shell/`                  | _(Phase 2)_ Explorer, Finder and Linux file-manager add-ons                                                                                |

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

| Task                          | Command                                                                          |
| ----------------------------- | -------------------------------------------------------------------------------- |
| Install                       | `pnpm install`                                                                   |
| Run the desktop app (dev)     | `pnpm app:dev`                                                                   |
| Run with arguments (dev)      | `pnpm app:dev -- -- log <path>`                                                  |
| Build installers              | `pnpm app:build`                                                                 |
| Frontend tests                | `pnpm test` (watch: `pnpm test:watch`)                                           |
| Rust tests                    | `pnpm test:rust`                                                                 |
| Lint (TS + file sizes) / Rust | `pnpm lint` / `pnpm lint:rust`                                                   |
| Type-check                    | `pnpm typecheck`                                                                 |
| Format / check formatting     | `pnpm format` / `pnpm format:check`                                              |
| Regenerate IPC bindings       | `pnpm bindings`                                                                  |
| Generate synthetic repos      | `pnpm repos:generate [--preset 10k 100k 1m]` (into `.cache/repos/`, git-ignored) |
| Regenerate app icons          | `pnpm icons` (from `assets/logo/noblame.svg`)                                    |
| Benchmarks                    | `pnpm bench` (none yet; M2 adds them, see `docs/development/performance.md`)     |
| Everything CI runs            | `pnpm check`                                                                     |

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
- **Events carry no data**: the main window drains `take_repository_requests` on start and on
  `RepositoriesRequested`, so early requests are not lost. Keep that pattern.
- **Cancelling git kills only the direct child**; on Windows a grandchild holding the pipe also
  keeps a Tokio blocking thread until it exits. Process-tree kill comes with jobs (M5).
- **Windows build "Access is denied"** running build scripts: Defender/Smart App Control;
  exclude the repo folder. Test binaries need the manifest embedded by `build.rs`.
- **Pinned versions**: `specta`/`tauri-specta` `=2.0.0-rc.26` + `specta-typescript =0.0.13`
  (upgrade together); TypeScript `~6.0` until typescript-eslint supports 7; jsdom 27 (jsdom 30
  needs Node ≥ 22.22).
- **cmdk ranks by `value`**: palette items use the visible label as `value`, never an id.
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
