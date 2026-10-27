# Command line, single instance and task windows

Phase 2 shell add-ons only build command lines, so the command line is the app's second front
door and was built in M1 ([ADR 0015](../adr/0015-cli-single-instance-task-windows.md)). The user
reference is [features/cli.md](../features/cli.md).

## Command line

```
noblame [PATH]               main window; PATH opens as a repository tab
noblame browse [PATH]        same as above
noblame <TASK> [PATH]        a focused task window for PATH (default: current folder)
noblame --help | --version
```

Tasks: `log commit diff blame filehistory pull push fetch switch merge rebase stash clone init`.

- `src-tauri/src/cli/task.rs`: `TaskKind` with `ALL`, `command_name()`, `title()`, `about()`.
  It is also the IPC type, so the CLI and the UI cannot drift apart.
- `src-tauri/src/cli/mod.rs`: the `clap` definition is built from `TaskKind::ALL`.
  `parse(args, cwd)` returns a `LaunchRequest { target: Main | Task(kind), path }`.
- Paths are resolved against the **caller's** working directory and normalized with
  `std::path::absolute` (no file system access: `.` is removed, and on Windows `..` and `/` are
  resolved). Symlinks are kept as typed.
- Because a bare word may be a path, a mistyped task name (`noblame comit`) is read as a path.
  M2's "not a repository" error makes that visible.

## Printing help

`main.rs` parses before Tauri starts. `--help`, `--version` and usage errors are printed and the
process exits with clap's exit code (0 or 2). Windows release builds are GUI-subsystem programs
without a console, so `cli::attach_parent_console()` attaches to the terminal that started
`noblame` first. The prompt may reappear before the text, a known Windows limitation.

## Single instance

`tauri-plugin-single-instance` is the first plugin registered. When a second `noblame` starts,
the plugin sends its `argv` and working directory to the running instance and the second process
exits. The running instance parses them with the same `cli::parse` and calls
`windows::launch`, as on first start.

## Windows

`tauri.conf.json` declares **no windows**; Rust opens them, so `noblame commit <path>` does not
open the main window as well.

| Label    | Opened by                                           | Content                                   |
| -------- | --------------------------------------------------- | ----------------------------------------- |
| `main`   | `noblame`, `noblame <path>`, `noblame browse`       | Sidebar, repository tabs, status bar      |
| `task-N` | `noblame <task> <path>`, `open_task_window` command | One task for one path (placeholder in M1) |

- `WindowRegistry` (managed state) maps task labels to their `WindowContext` and holds the queue
  of repositories the main window should open. A task window forgets its entry when destroyed.
- Each window's frontend calls `get_window_context` on start and renders the main layout or
  `TaskWindowView`.
- Opening a repository in the main window: the request is queued, the main window is shown or
  created, and `RepositoriesRequested` is emitted. The main window drains the queue on start and
  on every event, so the request survives a window that is still loading.
- Titles: `NoBlame` for the main window, `<Task> — <folder> — NoBlame` for task windows. The
  title bar icon is the app icon.
- Windows are created only from the setup hook, the single-instance callback or `async`
  commands; creating a window from a sync command deadlocks on Windows.
- When the last window closes the app exits (Tauri default). M8 decides whether task windows are
  reused per path and refines closing behaviour.

## Capabilities

Task windows get a narrower capability (`capabilities/task.json`, `task-*`) than the main
window (`capabilities/main.json`). Every new command must be granted explicitly to the windows
that need it.

## Phase 2 contract

A shell extension needs to know only the executable path and the subcommands above. It must pass
paths as separate arguments (never through a shell), and it may rely on the running instance
receiving the request within milliseconds.
