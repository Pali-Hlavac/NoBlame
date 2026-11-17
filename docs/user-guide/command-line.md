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
- **`commit`** shows the changes to commit beside their diffs. Given a folder, it lists only
  the changes in that folder, and **Stage all** stages only those. If files elsewhere are
  already staged, the window says so: committing takes them too. Given a file, its diff shows
  at once.
- **`diff`** lists the changes of the folder (or the file) beside the diff of the one you
  choose; given a file, its diff shows at once. You can stage or discard parts of it there.
- **`blame`** shows who last changed each line of a file, as it is in your last commit. Click
  a line's commit to see it beside. Blame needs a file; for a folder, use `filehistory`.
- **`filehistory`** lists the commits that changed a file or a folder. Choose one to see its
  details and files.
- **`fetch`**, **`pull`** and **`push`** ask first: Fetch from where, Pull how, Push where
  to. Then git's output shows in the window while it works, and a message says how it went.
  If you closed the question, the button at the top (**Pull…**) asks again. Pull and Push need
  a current branch.
- **`switch`**, **`merge`** and **`rebase`** ask which branch, remote branch or tag: type part
  of its name to narrow the list, or type a commit id (or `HEAD~2`) and choose **Use …**.
  Switching to one of your branches happens at once; a remote branch gets a branch of yours
  that follows it; a tag or a commit is checked out without a branch, after an explanation.
  Merging and rebasing start on the branch your current branch follows (marked "upstream") and
  then ask how, as from the graph. If a merge or rebase is still unfinished, the window says so:
  finish or abort it first with the bar above the commits.
- **`stash`** shows your stashes beside the commits and asks what to stash. Given a folder, it
  lists and stashes only the changes in that folder.

The button at the top of these windows (**Switch…**, **Merge…**, **Stash changes…**) asks
again after you closed the question.

- **`clone`** asks for the repository's URL and clones it into a new folder inside the folder
  given (named after the repository; you can change both), with the same options as **Clone
  repository** in the main window. Git's output shows while it works; then **Open in NoBlame**
  shows the new repository (it opens there by itself while **Open it when done** stays ticked).
  If the clone fails, the window says why and **Try again** brings the form back.
- **`init`** creates a repository in the folder given (or one you type or browse to). Before you
  click **Create** it tells you what is there: a folder that does not exist yet is created; files
  already in it stay, not committed yet; a folder that is a repository already is not created
  again (**Open in NoBlame** opens it instead); and a folder inside another repository gets a
  warning, because the new repository would sit in that one untracked.

**Closing by themselves**: with **Settings → Task windows → Close a task window once its
action succeeded**, a Commit, Pull, Push, Fetch, Switch, Merge, Rebase or Stash window closes a
moment after its action worked. It stays open when something fails or conflicts, so you can
see why. The setting is off at first.

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
