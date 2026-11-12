# Command line

You can start NoBlame from a terminal or a script with the `noblame` command.

## Opening the main window

```sh
noblame                  # open NoBlame
noblame path/to/repo     # open NoBlame with this repository in a tab
noblame browse path/to/repo   # the same, written out
```

Relative paths are relative to the folder you run the command in. `noblame .` opens the current
folder.

## Opening a task window

```sh
noblame <task> [path]
```

This opens a small window for one task. Without a path, the task uses the current folder.

| Task          | What it is for                                          |
| ------------- | ------------------------------------------------------- |
| `log`         | The commit graph of a repository or history of a folder |
| `commit`      | Stage changes and commit them                           |
| `diff`        | The changes in the working tree                         |
| `blame`       | Who last changed each line of a file                    |
| `filehistory` | The history of a file                                   |
| `pull`        | Fetch and integrate changes from a remote               |
| `push`        | Push commits to a remote                                |
| `fetch`       | Download objects and refs from remotes                  |
| `switch`      | Switch to another branch                                |
| `merge`       | Merge a branch into the current branch                  |
| `rebase`      | Rebase the current branch                               |
| `stash`       | Stash changes or restore stashed changes                |
| `clone`       | Clone a repository into a folder                        |
| `init`        | Create a new repository in a folder                     |

Example:

```sh
noblame commit ~/src/my-project
```

At the top of a task window you see the task, the repository and the folder or file it is
about. **Open in NoBlame** shows that repository in the main window.

- **`log`** shows the commits of the repository. Given a folder or a file, it shows only the
  commits that changed it; the path appears in the graph's filter bar, where **Clear** shows
  every commit. Beside the graph are Branches, Commit details, Changed files and Files.

**Not done yet**: the other task windows show their task and path and say which milestone
delivers them. They do not commit, push or change anything yet.

Running the same task on the same folder again brings its window to the front instead of
opening another one. You can close the main window and keep task windows open; NoBlame ends when
its last window closes.

## NoBlame is already running

If NoBlame is already open, running `noblame` again does not start a second copy. The running
NoBlame opens the requested repository tab or task window, and the command returns at once. A
task-only command (`noblame commit …`) opens just the task window, without the main window.

## Help and version

```sh
noblame --help        # list every command
noblame commit --help # help for one task
noblame --version
```

A mistyped option or an extra argument prints an error and the usage, and NoBlame does not
start.

## Known quirks

- **Windows**: in installed builds the prompt can come back before the help text appears. The
  text still prints; press Enter to get a fresh prompt.
- A single unknown word is read as a folder name. For example `noblame comit` (a typo) opens the
  main window with a tab named "comit", which says the folder is not a Git repository. Use
  `noblame --help` to check task names.
- Folder paths with characters that are not valid Unicode cannot be opened yet. NoBlame shows an
  error asking you to open a folder with a valid name.
