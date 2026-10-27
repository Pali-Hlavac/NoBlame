# Architecture overview

NoBlame is a Tauri 2 app: a Rust process that owns every repository and every child process,
and one webview per window that renders the UI in React. Decisions: [ADR 0001](../adr/0001-tauri-2-desktop-shell.md),
[ADR 0002](../adr/0002-rust-owns-git-access.md), [ADR 0005](../adr/0005-code-organization.md).

## Components

```
┌───────────────────────── webview (one per window) ─────────────────────────┐
│ React feature components                                                    │
│   → feature api hooks (TanStack Query)        src/features/<f>/api/*.ts     │
│   → typed client: unwrap(commands.x())        src/shared/ipc/client.ts      │
└───────────────────── Tauri IPC (JSON, ACL-checked per window) ──────────────┘
┌──────────────────────────── Rust process (src-tauri) ──────────────────────┐
│ #[tauri::command] in <module>/commands.rs     thin: extract State, map error│
│ <module>/service.rs                           app logic                     │
│ crates/git-core                               no Tauri: git CLI runner now, │
│                                               gix reads, graph, cache later │
└─────────────────────────────────────────────────────────────────────────────┘
          │ spawns (argument arrays only)
          ▼
      user's `git`
```

| Crate / folder    | Responsibility                                                                 |
| ----------------- | ------------------------------------------------------------------------------ |
| `crates/git-core` | Git engine. M1: `cli` (locate, version, safe command builder, cancellable run) |
| `crates/repo-gen` | Deterministic synthetic repositories for tests and benchmarks                  |
| `src-tauri`       | Tauri app: commands, windows, CLI parsing, settings, error mapping             |
| `src/app`         | App shell: root component, main window layout, status bar, palette wiring      |
| `src/features/*`  | Feature folders with a public `index.ts`                                       |
| `src/shared`      | IPC client and generated bindings, UI primitives, shared components and hooks  |

### Rust modules in `src-tauri/src`

| Module     | What it does                                                                                    |
| ---------- | ----------------------------------------------------------------------------------------------- |
| `cli`      | `clap` definition generated from `TaskKind::ALL`; parsing to a `LaunchRequest`                  |
| `windows`  | Main window, task windows, window context registry, second-launch forwarding                    |
| `git_env`  | Locating git, its version and support status; git error → `AppError` mapping                    |
| `settings` | User preferences (theme) as JSON in the app config directory                                    |
| `storage`  | Atomic JSON file helper used by settings                                                        |
| `app_info` | Name, version, platform                                                                         |
| `error`    | `AppError { code, message, hint }` ([ADR 0006](../adr/0006-error-model.md))                     |
| `ipc`      | Command and event registry, bindings export ([ADR 0003](../adr/0003-tauri-specta-typed-ipc.md)) |

### Frontend features in `src/features`

| Feature           | What it does                                                             |
| ----------------- | ------------------------------------------------------------------------ |
| `workspace`       | Tabs store, tab bar, welcome view, tab shortcuts                         |
| `repositories`    | Repository tabs (placeholder view until M2), sidebar list, folder picker |
| `windows`         | Window context, task window placeholder, CLI repository requests         |
| `git-env`         | Git status button, notice, About rows                                    |
| `command-palette` | `Ctrl+K` palette                                                         |
| `settings`        | Theme preference, controller and menu                                    |
| `about`           | About dialog                                                             |

## Data flow

- **Backend data** (settings, git info, window context) is fetched with TanStack Query hooks in
  each feature's `api/` folder and never copied into Zustand.
- **UI-only state** (tabs, open dialogs) lives in Zustand stores in `store/`.
- **Events** from Rust (`RepositoriesRequested`) are typed by tauri-specta. Events only signal
  that something changed; the data is then read with a command, so nothing is lost when an event
  fires before a window has subscribed.
- **Bulk data** (graph rows, M2) will use a binary Tauri `Channel`, never JSON commands
  ([ipc.md](ipc.md)).

## Threading model

- The **Tauri main thread** runs the event loop and sync commands. Commands that do I/O are
  `async` and run on the Tokio runtime; CPU-heavy work goes to `spawn_blocking` or a dedicated
  thread. `get_window_context` and `take_repository_requests` are sync because they only read
  memory.
- **Window creation** happens in the setup hook, the single-instance callback or an `async`
  command. Creating a window inside a sync command deadlocks on Windows.
- **Child processes** (`git`) are spawned by Tokio with piped output and `kill_on_drop`. A
  `CancellationToken` cancels them. On Windows Tokio reads child pipes on blocking threads, so a
  grandchild that keeps a pipe open (for example `ssh` under `git fetch`) holds a blocking thread
  until it exits; the M5 job model kills whole process trees.
- The **webview** never blocks on the backend: every call is a promise, rendered through
  loading, error and empty states.

## Startup sequence

1. `main.rs` parses the command line. `--help`, `--version` and usage errors are printed (on
   Windows release builds after attaching to the parent console) and the process exits.
2. `run()` installs logging, builds the IPC registry, and (debug builds) regenerates bindings.
3. The single-instance plugin checks for a running instance. If there is one, the arguments and
   working directory are forwarded and this process exits.
4. The setup hook loads settings, registers the window registry and opens the window the
   command line asked for: the main window or a task window. `tauri.conf.json` declares no
   windows.
5. Each window's React app asks `get_window_context` what it is and renders the main layout or
   the task view.

## Where to go next

- Commands and events: [ipc.md](ipc.md)
- Git access rules: [git-engine.md](git-engine.md)
- Command line and windows: [cli-and-windows.md](cli-and-windows.md)
