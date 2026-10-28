# Workbench layout

Status: **built in M2.5 (2026-10-28)** as agreed with the owner. What exists and how it works:
[features/workbench.md](../features/workbench.md); the library choice: ADR 0020 (dockview).
Changed files and the diff tab (M3), and the stash and toolbar actions (M4, M5) follow this
design.

## Why the current shell is not enough

The M1/M2 shell copies the RipeMongo pattern: one sidebar, document tabs and one content area.
That works for an app with a handful of views. A Git client like Git Extensions shows many views
at once: branches, the commit graph, commit details, changed files and the diff. They will not fit
into one sidebar and one content area without clutter, and new modules would have nowhere to go.

## The owner's requirements (2026-10-28)

1. Besides the list of open repositories: **local and remote branches**.
2. **Selecting a commit** shows its changed files; clicking a file shows **its diff immediately**.
   Also basic commit information: message, date, hash, the tags (and branches) containing it.
3. **Stash management**: choose the files to stash, choose the stash to apply, possibly apply only
   a few files from a stash.
4. **Buttons** for Pull, Fetch, and Fetch and prune.
5. An **activity bar** that opens modules in the left panel. The left panel is the sandbox for
   future functions and keeps the UI tidy.
6. The **diff of a file** opens in a tab that can be docked left, right, top or bottom, as in
   VS Code.
7. **Submodules** appear in the Repositories module, nested under their repository.

## Decisions (owner's answers, 2026-10-28)

| #   | Question                            | Decision                                                                                                                                                                                                               |
| --- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Where do repositories open?         | The Repositories module opens a **repository tab** (a graph tab) in the main area.                                                                                                                                     |
| 1   | How many diff tabs?                 | **One diff tab.** Selecting another file switches its content; the tab stays where it is docked (for example beside the repository tab) instead of opening on top of the repository. Several diff tabs may come later. |
| 2   | Saved layout                        | **One layout for all repositories**, and the **open tabs are restored** between sessions.                                                                                                                              |
| 3   | Where are a commit's changed files? | In a **Changed files module** in the left dock. Modules from the activity bar open in the left dock.                                                                                                                   |
| 4   | What follows a commit selection?    | Clicking a commit in a repository tab **updates every module related to it**: Commit details, Changed files and the diff tab.                                                                                          |
| 5   | Toolbar                             | **Pull** (split button: pull, fetch, fetch all, fetch and prune), **Push**, **Commit**, **Stashes**. Not final; refine when building it.                                                                               |
| 6   | Order of work                       | **M2.5 (this workbench) next**, then the rest of M2 (working-tree rows, cache, watcher).                                                                                                                               |

## Layout

```
┌────┬─────────────────────┬──────────────────────────────────────────────────────────┐
│ A  │ Left dock (modules) │ Toolbar: Pull ▾ │ Push │ Commit │ Stashes │   main ↑2 ↓5     │
│ c  │ ┌─────────────────┐ ├──────────────────────────────────────────────────────────┤
│ t  │ │ Repositories    │ │ Main dock: document tabs, splittable                      │
│ i  │ │  ▸ linux        │ │ ┌ [linux ×] [noblame ×] ┐ ┌ [Diff: src/main.rs ×] ┐      │
│ v  │ │  ▾ noblame      │ │ │ commit graph          │ │ diff of the file       │      │
│ i  │ │     └ vendor/x  │ │ │ (repository tab)      │ │ selected in Changed    │      │
│ t  │ ├─────────────────┤ │ │                       │ │ files                  │      │
│ y  │ │ Commit details  │ │ │                       │ │                        │      │
│    │ ├─────────────────┤ │ │                       │ │                        │      │
│ b  │ │ Changed files   │ │ │                       │ │                        │      │
│ a  │ │  M src/main.rs  │ │ └───────────────────────┘ └────────────────────────┘      │
│ r  │ └─────────────────┘ │                                                           │
├────┴─────────────────────┴──────────────────────────────────────────────────────────┤
│ Status bar                                                                          │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

- **Activity bar** (icons, far left): each icon opens a module in the left dock or brings it to
  the front. Modules: Repositories, Branches (local, remote, tags), Commit details, Changed files,
  Stashes; later Submodules actions, Worktrees, Search, Reflog, Bisect, Scripts. A small registry
  makes a new module one feature folder plus one registration.
- **Left dock**: holds the open modules; they can be stacked as tabs or split vertically, resized,
  and the whole dock collapsed.
- **Main dock**: document tabs. **Repository tabs** show the commit graph of one repository. The
  **diff tab** shows one file's diff. Tabs can be split side by side or above each other and moved
  between groups.
- **Active repository**: the repository of the most recently focused repository tab. The toolbar
  and every repository-related module (Branches, Commit details, Changed files, Stashes) follow it.
- **Selected commit**: clicking a commit in the active repository's graph updates Commit details,
  Changed files and the diff tab.
- **Toolbar**: above the main dock, acting on the active repository.
- **Persistence**: the layout (both docks) and the open tabs are saved and restored on start.

### Repositories module

- Lists open repositories (and below them, recent ones), each with its **submodules nested as a
  tree** (recursively), read from the repository's submodule configuration.
- Clicking a repository or submodule opens (or focuses) its repository tab.
- Submodules that are not initialized are shown dimmed; initializing them is an M7 action.

### Diff tab

- There is at most one. Selecting a file in Changed files shows it there and focuses the tab
  without moving it.
- When another commit is selected and the same file changed in it, the tab shows that file's diff
  in the new commit; otherwise it shows "Select a file".
- "Open in window" (the `noblame diff` task window) and several diff tabs are later ideas.

### Stashes

- The Stashes module lists stashes (message, branch, date). Selecting one shows its files and
  diffs in Changed files and the diff tab (a stash is a commit).
- **Create**: a dialog listing the changed files with checkboxes, a message, and options to keep
  the index and include untracked files (`git stash push -m <message> -- <paths>`).
- **Apply, pop, drop** a whole stash; drop asks for confirmation and names the stash.
- **Apply only selected files**: for tracked files `git restore --source=stash@{n} -- <paths>`;
  untracked files come from the stash's third parent. To be verified in M4.

## Technology

- Docking library candidates, both MIT licensed: **dockview** (8.x, React, no other runtime
  dependencies; tabs, splits, floating groups, popout, layout serialization) and
  **flexlayout-react** (0.11). Two docks (left and main) may be two instances or one dock with a
  fixed left group; the spike decides.
- The spike checks: canvas graph resizing, keyboard access and focus handling, theming with our
  tokens, saving and restoring layouts and tabs, and how "popout" maps to Tauri windows.

## Still open (small, decide while building)

- Exact toolbar contents and order. Built as decision 5: Pull ▾, Push, Commit, Stashes, then the
  active repository and branch.
- Default arrangement of the modules in the left dock. Built as Repositories and Branches on top,
  Commit details and Stashes below; Changed files will join the lower group in M3.

## Ideas inbox

Ideas from the owner, newest last, with where each one is planned.

- 2026-10-28: local and remote branches next to the repositories → M2.5 (read-only module), M5
  (actions).
- 2026-10-28: commit selection shows changed files, the diff on click, and commit information
  including the tags containing it → M2.5 (Commit details), M3 (Changed files, diff tab).
- 2026-10-28: stashes with file selection, choosing which stash to apply, applying only some files
  → M2.5 (read-only Stashes module), M4 (actions).
- 2026-10-28: toolbar with Pull, Fetch, Fetch and prune → M2.5 (toolbar, buttons disabled and
  labelled), M5 (the operations).
- 2026-10-28: activity bar and left dock as a sandbox for future modules → M2.5.
- 2026-10-28: the diff in a dockable tab → M2.5 (main dock), M3 (diff tab content).
- 2026-10-28: one diff tab that switches files instead of opening new ones; several later → M3.
- 2026-10-28: restore open tabs and the layout between sessions → M2.5.
- 2026-10-28: submodules nested under their repository in the Repositories module → M2.5 (list),
  M7 (submodule actions).
