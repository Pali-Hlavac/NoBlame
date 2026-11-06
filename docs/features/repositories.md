# Repositories

Opening and creating repositories, repository tabs, recent repositories and the commit-graph
offer. Architecture: [git-engine.md](../architecture/git-engine.md#opening-repositories),
[ipc.md](../architecture/ipc.md). User guide:
[opening-repositories.md](../user-guide/opening-repositories.md).

Status: **M2 in progress.** Open, create, recent list, kinds, HEAD and the commit-graph offer are
done; the file watcher and the on-disk cache are still to come.

## Opening

A repository opens in a tab from:

- **Open repository…** (Welcome tab, Repositories module, command palette): a folder picker.
- The **recent repositories** list on the Welcome tab and in the Repositories module.
- A **submodule** in the Repositories module ([workbench.md](workbench.md#modules)).
- The **command line**: `noblame <path>` ([cli.md](cli.md)).

Any folder inside a repository works: NoBlame searches upwards like git and opens the repository
that contains it. The tab keeps the path that was opened; the header shows the repository root.
Opening a path that is already open focuses its tab.

When the folder is not inside a repository, the tab shows "… is not a Git repository" with
**Try again** and **Create a repository here**.

## Creating

**Create repository…** (Welcome tab, command palette) asks for a folder, runs `git init -- <folder>`
with the user's git (creating the folder if needed) and opens it. Failures appear as a toast with
git's message.

## Repository tab

- **Header**: name, where HEAD points (branch name; "`<branch>` (no commits yet)" for a new
  repository; "detached at `<short id>`"), badges for **Bare**, **Worktree** (linked worktree),
  **Submodule** and **Shallow clone**, and the full path. Buttons open the Log, Commit and File
  history task windows, which are placeholders until M8.
- **Commit-graph offer** (see below).
- **Commit graph**: [commit-graph.md](commit-graph.md).

Each tab has a backend session: opened when the tab first renders, kept while the tab is hidden,
and closed when the tab is closed. Reopening the repository later opens a new session.

## Actions menu

In the Repositories module, every repository row has a **…** button (on hover or focus): open
repositories, repositories in groups (open or not) and initialized submodules. It offers Copy
path, Open (only when not open) and Close (only when open), plus Pull, Fetch, Push and Commit…
as labelled placeholders until M4/M5; in a group also **Remove from group**. The app shell
supplies the actions (`src/app/workbench/repositoryActions.ts`, `when: "open" | "closed"`,
filtered by `actionsFor`); a row adds its own items with `extra`. **Settings → Repositories**
hides the button. See [workbench.md](workbench.md#modules).

Icons take the kind colours used across the app ([workbench.md](workbench.md#colours-by-kind-of-work)):
groups and the group entries of menus `groups` (orange), repositories, Open and Create
`repositories` (blue), submodules `submodules` (violet).

## Live updates

Each open repository is watched for changes made outside NoBlame (a commit in a terminal, an
editor saving a file, a fetch):

- **Working tree or index changed** → the uncommitted changes are counted again.
- **HEAD, a branch, a tag, a remote branch or the stash moved** → the header (current branch),
  the graph, Branches, Stashes and Commit details reload. A selected commit stays selected; if
  HEAD was selected, the selection follows HEAD (so after committing, the new commit is
  selected); a selected commit that no longer exists falls back to HEAD.

What is ignored:

- objects, logs and lock files inside `.git`;
- files that `.gitignore`, `info/exclude` or `core.excludesFile` ignore (builds writing into
  `target/` or `node_modules/` cause no work).

Bursts of changes are reported once, 300 ms after the last one. If watching cannot start (for
example the Linux inotify limit, `fs.inotify.max_user_watches`), a warning is logged and the
status is still re-read whenever the window regains focus. A refs change rebuilds the whole
graph, but only new commits are read: the rest is copied from the previous build (ADR 0010).
For a million commits a reload takes about half a second in a release build, mostly refs and
layout.

## Graph cache

After each build, the commit index is saved in the app's cache folder (`graph-cache`, about 40
bytes per commit). Reopening a repository then reads only the commits made since, which matters
most for repositories without a commit-graph file. A damaged or outdated file is ignored and
deleted; files not used for 30 days are deleted at start-up. Shallow and partial clones are not
cached. Deleting the folder is always safe.

## Recent repositories

- Shown on the Welcome tab and under **Recent** in the Repositories module (without the ones
  already open), newest first, at most 20.
- Updated every time a repository opens (by any route). The same path is never listed twice
  (compared case-insensitively on Windows).
- Entries whose folder no longer exists are dimmed and still clickable (the tab then explains the
  error). Each entry can be removed with its **×** button.
- Stored in `recent-repositories.json` in the platform config directory. If the file cannot be
  written, the repository still opens and a warning is logged.

## Uncommitted file counts

Owner request 2026-11-02, M4 slice 7. With **Settings → Repositories → Show the number of
uncommitted files beside repositories** (off by default), each repository row in the
Repositories module (Open, Groups, Recent; not submodules) shows its uncommitted files at the
right end: `+3 ~2 −1` for new, changed and deleted files, zeros left out, nothing when the
working tree is clean or the repository is bare. Pointing at it says "3 new, 2 changed and 1
deleted files not committed"; screen readers read that after the name.

- Each file counts once, staged or not, by what happened to it since `HEAD`: new (untracked,
  added, or added with `--intent-to-add`), deleted (from the index or the working tree), or
  changed (modified, type changed, renamed, copied, conflicted). A file added and then changed
  again is new. Counted while parsing `git status` (`ChangeCounts` in
  `git_core::status::summary`), so all files count, not only the 5,000 listed.
- **Open repositories** use their session's status (`get_status`, `summary.changes`): no extra
  `git status`, and the file watcher keeps it current. A group's repository that is open does
  the same.
- **Closed repositories** (in a group or under Recent) run `get_change_counts(path)`: one
  `git status --porcelain=v2 -z` with the repository's `status.showUntrackedFiles`, no session.
  At most 4 run at once (`COUNT_RUNS`), so twenty recent repositories never start twenty gits.
  They are counted when the module shows them and again when the window regains focus, if the
  counts are older than 15 s (`CLOSED_COUNTS_STALE_MS`); closing a repository's tab counts it
  again. A failure (an untrusted repository, a broken one) shows no counts; a missing folder is
  not read.
- With the setting off nothing runs. Timings are in
  [performance.md](../development/performance.md#repositories-module-counts-m4-slice-7-2026-11-06).

## Sections

The module has three sections: **Open**, **Groups** and **Recent** (Recent only when a recent
repository is not open). Clicking a section's title folds it; dragging the title onto another
section moves it there (before it, or after it on its lower half), and Alt+Up / Alt+Down on the
title moves it by one. The order and the folded sections are settings
(`repositories.sections`, `repositories.collapsedSections`); the UI ignores repeats and adds
missing sections at the end (`lib/sections.ts`).

## Groups

Folders of repositories, like bookmarks, under **Groups** in the Repositories module (between
Open and Recent). Owner request 2026-11-02.

- **New group** (the list-plus button at the top of the module) adds "New group" (numbered when
  taken) with its name as a text field: type and press Enter. F2, the group's **…** menu or its
  right-click menu rename it later; Escape cancels.
- **Adding repositories:** drag any repository row (open, recent or in another group) onto a
  group, or right-click it → **Add to group** → a group or **New group…**. A repository is
  listed once per group; it may be in several groups.
- **Order:** drag a repository onto another one in a group to put it before it (after it on the
  row's lower half); drag a group onto another to reorder groups, or use **Move up / Move down**.
- **Folding:** click a group (or its arrow); the state is saved.
- A grouped repository shows its submodules nested below it, as in Open (read from the folder
  with `list_submodules`, so the repository need not be open; foldable).
- A grouped repository opens (or shows) its tab on click, is bold while open, and dimmed when
  its folder is gone. Right-click → **Move to group** or **Remove from group**.
- The group's menu: **Open all**, **Pull all** and **Push all** (shown disabled, M5), Rename,
  Move up/down, **Delete group…** (asks first when it holds repositories; the repositories
  themselves are not touched).
- Stored in `repository-groups.json` in the platform config directory:
  `get_repository_groups` and `save_repository_groups` (the whole list; small). Saving cleans the
  list up (repeated ids and paths dropped, names trimmed to 100 characters, an empty name becomes
  "Group"). The UI edits its query cache at once (`lib/groups.ts`, pure functions) and sends the
  saves one after another, so quick edits never overwrite each other.
- Drag and drop uses custom data types (`lib/dragData.ts`), so dock tabs and files dropped on the
  module are ignored.

## Commit-graph offer

When a repository has no commit-graph file, a notice above the graph explains that history loads
much faster with one and offers **Write commit-graph**. It runs
`git commit-graph write --reachable --changed-paths` in the repository, which can take a minute on
very large repositories (68 s for 1M synthetic commits). The notice can be dismissed for the
session. Until the job model of M5 arrives the command cannot be cancelled.

The notice says what the file is: one index file added to the `.git` folder; commits, branches
and files do not change. When the first load took longer than 2 s (`SLOW_LOAD_MS`), the notice
is highlighted and names the cost, for example "Reading 1,503,174 commits took 10.9 s … Writing
one takes about 11 seconds, once". The write time is estimated at 7.3 µs per commit, measured on
the Linux kernel. NoBlame never writes the file without the click (owner decision 2026-10-28;
writing it automatically may come later as a setting that is off by default). From the second
open on, the index cache (ADR 0010) makes loads fast anyway, so the notice is plain again.

## Untrusted repositories

A repository owned by another user and not listed in git's `safe.directory` is refused, as git
itself would refuse it. The message names the repository and the hint shows the exact command to
trust it (`git config --global --add safe.directory "<path>"`). NoBlame never runs that command
or changes `safe.directory` itself. This path is not covered by an automated test yet.

## Edge cases

- Bare repositories show the repository directory as their path.
- Linked worktrees show their own branch.
- Shallow clones end at the shallow boundary in the graph.
- Paths that are not valid Unicode cannot be opened yet.
