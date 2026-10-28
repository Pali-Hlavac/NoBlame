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

## Recent repositories

- Shown on the Welcome tab and under **Recent** in the Repositories module (without the ones
  already open), newest first, at most 20.
- Updated every time a repository opens (by any route). The same path is never listed twice
  (compared case-insensitively on Windows).
- Entries whose folder no longer exists are dimmed and still clickable (the tab then explains the
  error). Each entry can be removed with its **×** button.
- Stored in `recent-repositories.json` in the platform config directory. If the file cannot be
  written, the repository still opens and a warning is logged.

## Commit-graph offer

When a repository has no commit-graph file, a notice above the graph explains that history loads
much faster with one and offers **Write commit-graph**. It runs
`git commit-graph write --reachable --changed-paths` in the repository, which can take a minute on
very large repositories (68 s for 1M synthetic commits). The notice can be dismissed for the
session. Until the job model of M5 arrives the command cannot be cancelled.

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
