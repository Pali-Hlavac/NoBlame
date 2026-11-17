# Command line and task windows

`noblame` opens the main window or a focused task window, and a second launch reuses the
running app. Architecture: [cli-and-windows.md](../architecture/cli-and-windows.md). User guide:
[command-line.md](../user-guide/command-line.md).

Status: **M1: parsing, forwarding and windows done. M8 in progress**: the task window frame,
`log` (limited to the folder or file given), one window per task and path, and sessions closed
with their window (slice 1); `commit` and `diff`, with the status of the folder or file given
(slice 2); `blame` and `filehistory` (slice 3); `fetch`, `pull` and `push` (slice 4); `switch`,
`merge`, `rebase` and `stash`, and closing a task window once its action succeeded (slice 5);
`clone` and `init`, the reference below and its tests (slice 6). **M8 is done.**

M2: a path passed on the very first launch (`noblame <path>` while NoBlame is not running) now
opens its tab; development builds lost it because React StrictMode drained the request queue
twice. Repository tabs now open real repositories ([repositories.md](repositories.md)).

## Reference

`noblame --help` prints this (the tests in `src-tauri/src/cli/tests.rs` check that this page
quotes it exactly, and that every task's path is described below):

```text
NoBlame, a fast Git client for giant repositories

Usage: noblame [path]
       noblame <COMMAND>

Commands:
  browse       Open the main window, optionally with a repository
  log          Show the commit graph of a repository or the history of a folder
  commit       Stage changes and commit them
  diff         Show the changes in the working tree
  blame        Show who last changed each line of a file
  filehistory  Show the history of a file
  pull         Fetch and integrate changes from a remote
  push         Push commits to a remote
  fetch        Download objects and refs from remotes
  switch       Switch to another branch
  merge        Merge a branch into the current branch
  rebase       Rebase the current branch
  stash        Stash changes or restore stashed changes
  clone        Clone a repository into a folder
  init         Create a new repository in a folder
  help         Print this message or the help of the given subcommand(s)

Arguments:
  [path]  Repository to open in the main window

Options:
  -h, --help     Print help
  -V, --version  Print version
```

`noblame <task> --help` prints the task's line, `Usage: noblame <task> [path]` and what its path
names:

| Task          | Window            | `[path]` (as `--help` says)                                      |
| ------------- | ----------------- | ---------------------------------------------------------------- |
| `log`         | Log               | Repository, folder or file (default: the current folder)         |
| `commit`      | Commit            | Repository, folder or file (default: the current folder)         |
| `diff`        | Diff              | Repository, folder or file (default: the current folder)         |
| `blame`       | Blame             | File to blame (default: the current folder)                      |
| `filehistory` | File history      | Repository, folder or file (default: the current folder)         |
| `pull`        | Pull              | Repository, folder or file (default: the current folder)         |
| `push`        | Push              | Repository, folder or file (default: the current folder)         |
| `fetch`       | Fetch             | Repository, folder or file (default: the current folder)         |
| `switch`      | Switch branch     | Repository, folder or file (default: the current folder)         |
| `merge`       | Merge             | Repository, folder or file (default: the current folder)         |
| `rebase`      | Rebase            | Repository, folder or file (default: the current folder)         |
| `stash`       | Stash             | Repository, folder or file (default: the current folder)         |
| `clone`       | Clone             | Folder that will hold the clone (default: the current folder)    |
| `init`        | Create repository | Folder to create the repository in (default: the current folder) |

Exit codes: 0 after opening a window (or handing the request to the running NoBlame), and
after `--help` and `--version` (`noblame 0.1.0`); 2 after a usage error, which names the problem
and prints the usage (`error: unexpected argument 'b' found`, then
`Usage: noblame commit [path]`).

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

| Task                        | Modules                                        | Tabs                                                          |
| --------------------------- | ---------------------------------------------- | ------------------------------------------------------------- |
| `log`                       | Branches; Commit details, Changed files, Files | The graph, filtered to the folder or file given (path filter) |
| `commit`                    | Commit (440 px wide)                           | Diff (the file given, if any), the graph (filtered)           |
| `diff`                      | Changed files: the working tree's changes      | Diff (the file given, if any), the graph (filtered)           |
| `blame`                     | Commit details, Changed files                  | Blame of the file as in `HEAD`, the graph (filtered)          |
| `filehistory`               | Commit details, Changed files                  | History of the file or folder, the graph (filtered)           |
| `fetch`, `pull`, `push`     | Branches                                       | The graph; the task's dialog opens at once                    |
| `switch`, `merge`, `rebase` | Branches                                       | The graph; which branch to use is asked at once               |
| `stash`                     | Stashes                                        | The graph; **Stash changes** opens at once                    |

Everything in a task window shows the status of the folder or file given: the Commit lists,
Changed files and the graph's working tree row. **Stage all** and **Unstage all** act on that
path only; files staged elsewhere stay staged, and the Commit form says "Also commits N files
staged outside `<path>`" because a commit takes the whole index. A `diff` or `commit` window
opened on a file shows its diff at once: its unstaged changes, or its staged ones when it has
only those.

`blame` needs a file: on a folder the window says "Blame shows the lines of a file, and this
is a folder" and suggests File history. `filehistory` on the top of the repository shows its
graph (the whole history). Choosing a line's or a row's commit shows it in Commit details.

`fetch`, `pull` and `push` open their dialog when the window opens, and again from the bar's
button (**Fetch…**, **Pull…**, **Push…**). Fetch asks which (the default remote, all remotes,
and prune), Pull how (as configured, merge, rebase, fast-forward only), Push is the Push dialog
of the current branch (remote, name there, upstream, tags, force). The job runs in the
background and the window's Git output window shows it, also when Settings turns that window
off for the main window; only the window that started a job shows its output and its toasts.
Pull and push need HEAD on a branch; on a detached HEAD the window says so. A credential prompt
shows in every open window; answering it in one closes it in the others.

`switch`, `merge` and `rebase` ask which reference to use (`src/app/tasks/RefPickDialog.tsx`):
local branches, remote branches and tags (`pickerSections`, at most 200, typing narrows), without
the current branch and the remotes' `HEAD`, or a revision typed in (**Use "…"**). Merging and
rebasing start on the current branch's upstream. The choice goes to the graph menu's action
(`RefActions`): a local branch is checked out at once, a remote branch opens "Create and check
out", a tag or a typed revision the detached HEAD explanation; Merge and Rebase open their
dialogs (how, and which commits are replayed). While a merge, cherry-pick, revert, rebase or
`git am` is in progress, the question says to finish or abort it and nothing can be chosen (a
bisect does not stop it). `stash` opens **Stash changes** (`openStashChanges`, mounted once per
window); in a window limited to a folder it lists only that folder's changes and always stashes
the chosen paths, never the whole working tree.

**Close after success** (Settings → Task windows, off by default): actions report success
through `shared/lib/actionDone.ts` (a commit; a pull, push or fetch job this window started; a
checkout, including "Create and check out" and a detached checkout; a merge or rebase that did
not stop on conflicts; a stash). A task window whose own action succeeded closes after 1.5 s
(`useCloseWhenDone`), so its toast is seen. Log, Diff, Blame and File history never close by
themselves; an action of another kind (a checkout in the Merge window) does not close the
window, and neither does finishing a merge later with Continue.

`clone` and `init` are about a folder that is not a repository yet, so their windows show a
form instead of a workbench (`src/app/tasks/FolderTaskWindow.tsx`), under the task bar without
**Open in NoBlame**:

- `clone`: the Clone form (`CloneForm`, shared with the main window's dialog) with the path
  given as **Into**; Clone starts the clone job, the window shows "Cloning into …" and the Git
  output window, then **Cloned** with the folder, **Open in NoBlame** and **Clone another**
  (**Open it when done** opens the main window by itself). A failed or cancelled clone shows
  git's message and **Try again**. A credential prompt shows in the window.
- `init`: the folder (editable, **Browse…**) and what is there (`inspect_folder`: missing,
  empty, holding files, a file, the repository around it and whether it is that repository's top
  folder). A file or an existing repository cannot be used (the latter offers **Open in
  NoBlame**); a folder inside another repository gets a warning that the new repository would
  sit in it untracked (a submodule is how to add one repository to another). **Create** runs
  `git init`, then **Created a repository**, **Open in NoBlame** and **Create another**.

Both report success for **Close a task window once its action succeeded** (`clone`, `init`).

A path outside a repository shows "… is not a Git repository" with Retry. A file path opens the
repository around it; a file that no longer exists cannot be opened (its folder can).

Verified 2026-11-12 (slice 1, Windows 11, dev build): `noblame log <repo>\src` opened only the
Log window, with 3 of 5 commits and `src` in the filter bar; running it again focused that window
(no second one); `noblame log <repo>\docs` opened a second window with 1 commit; **Open in
NoBlame** opened the main window with the repository's tab; closing the main window left both
task windows running, each window closed its repository sessions, and closing the last task
window ended the app.

Verified 2026-11-12 (slice 2): `noblame commit <repo>\src` with `src/deep/a.txt` changed,
`src/new.txt` new, `docs/b.md` changed and `README.md` staged: the lists showed the two `src`
files only, the form "Also commits 1 file staged outside src"; **Stage all** staged the two
`src` files (`docs/b.md` stayed unstaged), choosing `a.txt` showed its diff, **Unstage all**
left `README.md` staged. `noblame diff <repo>\src\deep\a.txt` opened with that file's diff
and Changed files listing it (after fixing: a file path failed to open, "path is not a
directory").

Verified 2026-11-12 (slice 3): `noblame blame <repo>\src\deep\a.txt` blamed the file at
HEAD (two lines, two commits); clicking a line's commit showed it in Commit details;
`noblame filehistory <repo>\src` listed the 3 commits that changed `src`; `noblame blame
<repo>\docs` explained that a folder cannot be blamed.

Verified 2026-11-12 (slice 4), on a scratch repository with a local bare remote and a second
clone pushing to it: `noblame pull` opened the Pull dialog; **Pull** fast-forwarded (output
window and toast in the Pull window, the graph and Branches updated); with the main window open
beside it, a second pull and a push from a Push window showed nothing in the main window;
`noblame push` opened the Push dialog of `master` and pushed (remote updated);
`noblame fetch`, **Fetch all remotes**: `origin/master` moved, Branches showed master one
behind.

## Verified (2026-10-27, Windows 11)

`noblame .`, `noblame log crates/git-core` and `noblame commit crates/git-core` forwarded to the
running dev instance; tab and window titles correct; `--help`, `--version` and a usage error
printed with exit codes 0 and 2.
