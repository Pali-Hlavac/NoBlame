# Command line and task windows

`noblame` opens the main window or a focused task window, and a second launch reuses the
running app. Architecture: [cli-and-windows.md](../architecture/cli-and-windows.md). User guide:
[command-line.md](../user-guide/command-line.md).

Status: **M1: parsing, forwarding and windows done; task windows are placeholders** (labelled
in the UI). The task UIs, path-scoped views and window reuse are M8.

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
- Every `noblame <task>` opens a new window, even for the same path (reuse is decided in M8).

## Verified (2026-10-27, Windows 11)

`noblame .`, `noblame log crates/git-core` and `noblame commit crates/git-core` forwarded to the
running dev instance; tab and window titles correct; `--help`, `--version` and a usage error
printed with exit codes 0 and 2.
