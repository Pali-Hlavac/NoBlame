# Blame

The **blame tab** shows a file at a commit with, beside each line, the commit that last changed
it. Status: M3 slice 8 (2026-10-31), ADR [0022](../adr/0022-file-history-and-blame.md).

## Behaviour

- **Opening**: right-click a file in Files and choose **Blame**, or click **Blame** in the file
  tab. Both blame the file at the commit they show. Like the history tab, it opens beside the
  repository tab, so the diff stays visible next to it.
- **The version stays**: selecting another commit does not change what the tab blames, so
  clicking a line's commit (which selects it) keeps the blame in place.
- **Gutter**: on the first line of each run of lines from one commit (a hunk), the short id,
  date, author and summary. A bar beside every line is stronger the more recent the change is
  among this file's commits. The tooltip has the full summary, the author's e-mail and time.
- **Clicking a commit** selects it in the graph (Commit details and Changed files follow). If
  the graph's filter hides it, or no branch reaches it, a message says so.
- **Context menu** on a commit (right click, Shift+F10, Menu key):
  - **Select the commit**;
  - **Show the change**: selects it, chooses the file under its name there in Changed files,
    and shows the diff tab;
  - **Blame the previous revision**: blames the file as it was in the commit's parent (under
    its old name after a rename), to see who wrote a line before this change. Disabled for the
    commit that added the file;
  - **Copy commit id**.
- **Back** returns to the version blamed before "Blame the previous revision", one step at a
  time. A new blame from Files or the file tab starts a new trail.
- The lines are the file tab's: numbers, syntax colours, virtualized and paged. Binary files,
  pictures and files over 64 MB are named instead of shown; a submodule cannot be blamed.

In a task window (`noblame blame <file>`, M8) the blame tab opens on the file as it is in
`HEAD`, beside Commit details and Changed files: see [cli.md](cli.md#task-windows-m8).

## How it works

- `git_core::blame::blame` runs `git blame --incremental <commit> -- <path>` (ADR 0022: faster
  than gix-blame, and it honours `blame.ignoreRevsFile`, `.mailmap` and rename following).
  - It runs with `GIT_NO_LAZY_FETCH=1` (`GitCommand::no_lazy_fetch`, git 2.45 and later): a
    partial clone never downloads old contents one by one; blame fails with git's message.
  - The output is parsed into hunks (line, count, original line, path), commits (summary,
    author, time, `previous` parent and path) and the paths a renamed file had.
- `get_blame(id, commit, path)` adds the file's blob id (for the lines) and returns everything
  at once. Hunks are a few numbers each; git.git's 7,860-line `diff.c` has 3,200. A newer blame
  cancels one still running in the session.
- Frontend: `src/features/blame/`.
  - The blame is cached by commit id and path; it never changes.
  - The tab reuses `FileContents` from the diff feature, which takes a `gutter`: a column
    rendered beside each line number.
  - Clicking uses "go to commit" (`go_to_commit`) to find the commit's row in the graph shown.

## Performance

`history_spike` (release, 2026-10-31) on git.git, blaming HEAD:

| File            | Lines | Hunks | Commits | Time   |
| --------------- | ----- | ----- | ------- | ------ |
| `builtin/log.c` | 2,858 | 1,490 | 395     | 0.51 s |
| `diff.c`        | 7,860 | 3,200 | 736     | 0.96 s |
| `sequencer.c`   | 7,091 | 2,837 | 582     | 0.81 s |

The time is git's. Not measured on the Linux kernel: that clone is blobless, so blame stops at
the first missing version.

## Not yet

- Showing lines as `git blame` finds them (`--incremental` streams them; the tab waits for
  all).
- Options: ignore whitespace (`-w`), detect moved or copied lines (`-M`, `-C`), ignore
  revisions chosen in the app.
- Blame of uncommitted changes (M4) and a blame window (`noblame blame <path>`, M8).
- Downloading the missing contents of a partial clone on request.
