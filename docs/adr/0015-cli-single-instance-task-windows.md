# 0015: CLI, single instance and task windows

- Status: Accepted
- Date: 2026-10-27
- Milestone: M1

## Context and problem

Phase 2 adds file-manager context menus (Explorer, Finder, Linux file managers) in the style of
TortoiseGit. Those add-ons should stay thin: they only build a command line such as
`noblame commit <path>`. The app must then open a focused window for that task, quickly, even
when it is already running. The same command line is useful from a terminal. Building this in
M1 means phase 2 is mostly wiring.

## Decision drivers

- One code path for terminal launches, file-manager launches and in-app actions.
- The list of tasks must not drift between the CLI and the UI.
- A second launch must reuse the running instance (fast, one cache, one set of windows).
- `--help` and usage errors must be visible, also from a Windows GUI build.

## Considered options

1. clap parsing in Rust, `tauri-plugin-single-instance`, windows created from Rust per request
2. A URL scheme (`noblame://commit?path=...`) registered with the OS
3. A separate small launcher binary that talks to the app over a local socket

## Decision outcome

Chosen option: **clap + single-instance plugin + windows created from Rust**.

Command line (`src-tauri/src/cli/`):

- `noblame [path]` and `noblame browse [path]` open the main window, with `path` as a repository
  tab.
- `noblame <task> [path]` opens a task window. Tasks: `log`, `commit`, `diff`, `blame`,
  `filehistory`, `pull`, `push`, `fetch`, `switch`, `merge`, `rebase`, `stash`, `clone`, `init`.
  The path defaults to the current folder.
- The clap definition is built with clap's builder API from `TaskKind::ALL` (`cli/task.rs`).
  `TaskKind` is also the IPC type, so the CLI, the bindings and the UI cannot drift.
- Paths are resolved against the caller's working directory with `std::path::absolute`, which
  drops `.` components (and on Windows resolves `..` and normalizes separators) without
  touching the file system.
- `main.rs` parses before Tauri starts. `--help`, `--version` and usage errors are printed and
  the process exits with clap's exit code. Release builds on Windows are GUI programs, so
  `cli::attach_parent_console()` calls `AttachConsole(ATTACH_PARENT_PROCESS)` first (the only
  `unsafe` block in the codebase). The shell prompt may return before the text appears.
- `bin_name("noblame")` keeps usage lines stable.

Single instance and windows (`src-tauri/src/windows/`):

- `tauri-plugin-single-instance` is the first plugin. A second launch forwards `argv` and its
  working directory to the running instance and exits; the running instance parses them with
  the same parser (`on_second_instance`).
- `tauri.conf.json` declares no windows. `launch()` creates them, so a task-only launch opens
  only the task window and no main window.
- Task windows get labels `task-1`, `task-2`, …; `WindowRegistry` maps each label to its
  `WindowContext { task, path }` and forgets it when the window is destroyed. Each window calls
  `get_window_context` on start to decide what to render.
- Repository requests for the main window are queued in the registry, then the
  `RepositoriesRequested` event is emitted. The main window drains the queue with
  `take_repository_requests` on mount and on every event, so a request sent while the window is
  still loading is not lost.
- Windows are only created from `async` commands or setup code: creating a window inside a
  synchronous command deadlocks on Windows.
- Paths cross IPC as strings. Non-UTF-8 paths are rejected with a clear `INVALID_INPUT` error for
  now instead of being changed lossily.
- In M1 task windows were labelled placeholders; M8 built them (see "M8 update" below).

### M8 update (2026-11-17)

- A task window is the main window's workbench made for one task: the task's modules and tabs on
  the path given, its layout never saved, under a bar naming the task, the repository and the
  folder, with **Open in NoBlame**. `clone` and `init`, which have no repository yet, show a form
  instead.
- Reuse rule: one window per task and path; the same command again brings it to the front.
  Repository sessions belong to the window that opened them and close with it; the app ends
  with its last window.
- A path limits what the window shows: the graph's path filter, and the status of that folder
  or file (Stage all and Unstage all act there).
- Jobs show their output and toasts only in the window that started them. A setting closes a
  task window once its action succeeded (off by default).
- Each task's `--help` names what its path is (`TaskKind::path_help`). Tests compare the help
  with the command line reference, `docs/features/cli.md`, so neither drifts.

### Consequences

Good:

- Phase 2 add-ons only need to start `noblame <task> <path>`.
- One parser for first and forwarded launches; tests cover every task.
- Task windows have their own, smaller capability set (`capabilities/task.json`).

Bad:

- A bare word is ambiguous: `noblame comit` (a typo) is read as a path. Opening repositories in
  M2 will report "not a repository" for such paths.
- Each task window is a separate webview, which costs memory; the same task on the same path
  reuses its window (M8).
- Non-UTF-8 paths cannot be opened yet.

## Pros and cons of the options

### URL scheme

- Good: works from browsers.
- Bad: registration differs per OS, encoding paths in URLs is fragile, and it does not help
  terminal users.

### Separate launcher binary

- Good: tiny process for the add-ons.
- Bad: a second binary and a custom protocol to secure and maintain; the plugin already does
  this.

## Links

- [ADR 0002](0002-rust-owns-git-access.md)
- [../architecture/cli-and-windows.md](../architecture/cli-and-windows.md),
  [../user-guide/command-line.md](../user-guide/command-line.md)
