# Command line and task windows

`noblame` opens the main window or a focused task window, and a second launch reuses the
running app. Architecture: [cli-and-windows.md](../architecture/cli-and-windows.md). User guide:
[command-line.md](../user-guide/command-line.md).

Status: **M1: parsing, forwarding and windows done. M8 in progress**: the task window frame,
`log` (limited to the folder or file given), one window per task and path, and sessions closed
with their window (slice 1). The other tasks are still labelled placeholders.

M2: a path passed on the very first launch (`noblame <path>` while NoBlame is not running) now
opens its tab; development builds lost it because React StrictMode drained the request queue
twice. Repository tabs now open real repositories ([repositories.md](repositories.md)).

## Reference

```
noblame [PATH]
noblame browse [PATH]
noblame <TASK> [PATH]
noblame --help
noblame --version
```

| Task          | Window title      | Purpose (from M8)                                   |
| ------------- | ----------------- | --------------------------------------------------- |
| `log`         | Log               | Commit graph of a repository or history of a folder |
| `commit`      | Commit            | Stage changes and commit                            |
| `diff`        | Diff              | Working tree changes                                |
| `blame`       | Blame             | Who last changed each line                          |
| `filehistory` | File history      | History of a file                                   |
| `pull`        | Pull              | Fetch and integrate                                 |
| `push`        | Push              | Push commits                                        |
| `fetch`       | Fetch             | Download from remotes                               |
| `switch`      | Switch branch     | Switch to another branch                            |
| `merge`       | Merge             | Merge a branch                                      |
| `rebase`      | Rebase            | Rebase the current branch                           |
| `stash`       | Stash             | Stash or restore changes                            |
| `clone`       | Clone             | Clone a repository                                  |
| `init`        | Create repository | Create a repository                                 |

## Behaviour

- `PATH` is relative to the folder the command runs in and is made absolute (`noblame .` opens
  the current folder, titled with its name).
- Task commands without `PATH` use the current folder.
- If NoBlame is running, the new process hands its arguments to it and exits immediately; the
  running app opens the tab or window and comes to the front.
- If NoBlame is not running and a task is requested, only the task window opens.
- Task windows can also be opened from a repository tab or the command palette.
- `--help` and `--version` print to the terminal (exit code 0); unknown options and extra
  arguments print a usage error (exit code 2).

## Edge cases and limits

- A mistyped task (`noblame comit`) is treated as a path; the tab named "comit" then shows "… is
  not a Git repository" (with a "Create a repository here" button).
- Paths that are not valid Unicode are refused with "NoBlame cannot open … yet".
- On Windows release builds, the prompt may return before `--help` text appears (the app is a
  GUI program that attaches to the terminal).
- Running the same task on the same path again brings its window to the front instead of
  opening a second one (M8). Paths are compared as typed: `src` and `src\` are the same, a
  differently cased path on Windows opens a second window.
- Closing the main window leaves task windows open; closing the last window ends NoBlame.

## Task windows (M8)

Each task window has a bar with the task, the repository and the folder or file it shows, and
**Open in NoBlame**, which shows the main window with that repository (its whole history) in a
tab. Below it is a workbench with the task's modules and tabs; arranging them works as in the
main window but is not kept.

| Task  | Modules                                        | Tabs                                                          |
| ----- | ---------------------------------------------- | ------------------------------------------------------------- |
| `log` | Branches; Commit details, Changed files, Files | The graph, filtered to the folder or file given (path filter) |

A path outside a repository shows "… is not a Git repository" with Retry.

Verified 2026-11-12 (slice 1, Windows 11, dev build): `noblame log <repo>\src` opened only the
Log window, with 3 of 5 commits and `src` in the filter bar; running it again focused that window
(no second one); `noblame log <repo>\docs` opened a second window with 1 commit; **Open in
NoBlame** opened the main window with the repository's tab; closing the main window left both
task windows running, each window closed its repository sessions, and closing the last task
window ended the app.

## Verified (2026-10-27, Windows 11)

`noblame .`, `noblame log crates/git-core` and `noblame commit crates/git-core` forwarded to the
running dev instance; tab and window titles correct; `--help`, `--version` and a usage error
printed with exit codes 0 and 2.
