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
  The tab then shows a "not a Git repository" error, which makes the typo visible.

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

| Label    | Opened by                                           | Content                              |
| -------- | --------------------------------------------------- | ------------------------------------ |
| `main`   | `noblame`, `noblame <path>`, `noblame browse`       | Sidebar, repository tabs, status bar |
| `task-N` | `noblame <task> <path>`, `open_task_window` command | One task for one path (M8)           |

- `WindowRegistry` (managed state) maps task labels to their `WindowContext` and holds the queue
  of repositories the main window should open. A task window forgets its entry when destroyed.
- Each window's frontend calls `get_window_context` on start and renders the main layout or
  the task window (`TaskWindow`).
- Opening a repository in the main window: the request is queued, the main window is shown or
  created, and `RepositoriesRequested` is emitted. The main window drains the queue on start and
  on every event, so the request survives a window that is still loading.
- Titles: `NoBlame` for the main window, `<Task> — <folder> — NoBlame` for task windows. The
  title bar icon is the app icon.
- Windows are created only from the setup hook, the single-instance callback or `async`
  commands; creating a window from a sync command deadlocks on Windows.
- **One window per task and path** (M8): `open_task_window` finds the open window with the same
  `WindowContext` (`WindowRegistry::find`) and brings it to the front instead of opening a
  second one. Paths are compared as typed (absolute, normalized by the parser).
- **Repository sessions belong to a window** (M8): `open_repository` records the calling
  window's label, and when any window is destroyed `close_with` forgets its context and closes
  its sessions (`RepoSessions::remove_owned_by`). The page cannot close them itself once its
  window is gone.
- When the last window closes the app exits (Tauri default): closing the main window leaves
  open task windows running, and closing the last task window ends the app when the main
  window is not open.

## Task windows (M8)

A task window is the main window's workbench made for one task (`src/app/layout/TaskWindow.tsx`,
`src/app/tasks/specs.ts`): the system's title bar, a bar naming the task, the repository and the
folder or file (`TaskBar`, with **Open in NoBlame**: the main window with the repository's top
folder), and a `Workbench` with the task's modules and tabs. Its layout is never saved
(`persist={false}`) and it has no command palette or status bar. On start the window:

1. opens the repository containing the path (`open_repository` searches upwards);
2. asks where the path lies in it (`get_path_scope`: relative with `/`, folder or file);
3. limits the window's status to that folder or file (`setStatusScope` in the working-tree
   feature: `get_status` gets the scope, so `git status` only looks there; **Stage all** and
   **Unstage all** stage that path, and the commit form names the files staged elsewhere,
   which a commit takes too);
4. readies the session for the task (the graph filter's path, so only the history of that
   folder or file shows, and the filter bar can clear it; `commit` and `diff` select the
   working tree changes and, given a file, choose it for the diff tab: unstaged, or staged when
   it has only that);
5. opens the task's tabs (the repository's graph, titled with its name; `commit` and `diff`
   the diff tab first).

`Repository::discover` starts in a file's folder, so a file path opens its repository; a path
that does not exist still fails (so a mistyped task name still reads as a missing folder).

A path outside any repository shows the error with Retry. The dialogs, the credential prompt
and the Git output window are mounted as in the main window (`WindowParts.tsx`), so the graph's
menus work there.

`clone` and `init` have no repository yet: they render a form (`FolderTaskWindow`,
`src/app/tasks/folderTasks.ts`) under the task bar, with the job events, the credential prompt
and the Git output window, and no repository session. `init` asks `inspect_folder` what is at
the path before `init_repository`. The help text and the command line reference
(`docs/features/cli.md`) are checked against each other by `src-tauri/src/cli/tests.rs`.

## Capabilities

Task windows get their own capability (`capabilities/task.json`, `task-*`): the repository
commands their views use and `open_in_main_window`, but not the main window's frame buttons
(they have the system's), repository requests, recent list, groups or layout. Every new command
must be granted explicitly to the windows that need it.

## Phase 2 contract

A shell extension needs to know only the executable path and the subcommands above. It must pass
paths as separate arguments (never through a shell), and it may rely on the running instance
receiving the request within milliseconds.
