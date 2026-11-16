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
  Stashes, Reflog and Worktrees; later Search, Bisect, Scripts. A small registry
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
- Submodules that are not initialized are shown dimmed; initializing and updating them is in
  their menus (M7 slice 1, [features/submodules.md](../features/submodules.md)).

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
  untracked files come from the stash's third parent. To be verified in M4. Verified (M4 slice 5,
  2026-11-04): `restore` would undo what the branch changed in those files since the stash, so
  their patch is merged with `git apply --3way` instead ([stashes.md](../features/stashes.md)).
- Built (M4 slice 5): selecting a stash shows its files and diffs in a **Stash tab** (like the
  compare tab), not in Changed files and the diff tab: those follow the graph's selected row, and
  a stash is not a row of the graph.

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
- 2026-10-28: open submodules are highlighted inside their parent's tree instead of being added
  as top-level repositories → done (M2.5).
- 2026-10-28: a custom title bar holding Pull, Push, Commit, Stashes and search, so the module
  tabs and the document tabs line up → done (M2.5), with macOS and Linux handled.
- 2026-10-28: tabs in the left dock are useful for now; revisit after using dragging and
  splitting for a while.
- 2026-10-28 (review 2): staged and unstaged changes as rows at the top of the graph, or
  somewhere else; where they show is a setting → M2 (artificial rows, with the setting), M4
  (staging).
- 2026-10-28 (review 2): the commit window as a modal dialog (the app behind it cannot be used)
  or as a module in the left dock; which one is a setting → done (M4 slice 2; the module is
  the default). Since 2026-11-04 the module popped out (below) is the dialog; the setting went.
- 2026-10-28 (review 2): a Settings button at the bottom of the activity bar → done (opens the
  Settings tab).
- 2026-10-28 (review 2): a "…" button on each repository with its actions (pull, commit, ...),
  like VS Code; showing it is a setting → done (menu and setting; the actions themselves arrive
  in M4 and M5).
- 2026-10-28 (review 2): quick Pull and Merge buttons on repository rows, as a setting → M5
  (Pull), M6 (Merge).
- 2026-10-28 (review 2): scrollbars still flickered while resizing the window or a splitter →
  fixed (dockview showed the tab strip's scrollbar during every resize; the commit list's sticky
  layer was a frame too tall).
- 2026-10-28 (review 2): clicking a commit highlights the commits by the same author and the
  lines leading into the commit; Esc clears that and keeps the selection → done (setting:
  "Highlight the selected commit").
- 2026-10-28 (review 2): configurable keyboard shortcuts in Settings → M7 (needs one keybinding
  registry first; today each feature registers its own).
- 2026-10-28 (review 2): filters for the commit graph (one branch, one author, changes to a file,
  search in messages) → done (M3 slice 4).
- 2026-10-30: the left dock keeps its width in pixels when the window is resized (the panels on
  the right may scale) → done.
- 2026-10-30: the diff's context set with − and + buttons, plus a button for the whole file,
  instead of a list of fixed values → done.
- 2026-10-30: a context menu on commits in the graph, with useful actions such as:
  - merge into the current branch;
  - check out a branch, or a commit;
  - create a branch here.

  The proposed full list is in the roadmap. → M3 (the menu, copy and inspect actions), M5
  (branch and tag actions), M6 (merge, rebase, cherry-pick, revert, reset).

- 2026-10-30: external merge tools, for example opening a conflict in VS Code → M6 (merge tools,
  with presets), and an external diff tool for the diff tab earlier, in M4.
- 2026-10-30: syntax highlighting for more languages → done (bat's 213 grammars via two-face).
- 2026-10-30: during pull, push, fetch and other long git operations, optionally see git's
  output live in a console-like popup window (off by default; the operations also run in the
  background) → M5 (job registry and output window).
- 2026-10-30 (second round): more or less context in the diff keeps the line in the middle of
  the view in place, like zooming in at that row → done.
- 2026-10-30: the diff blinked while loading after a context change; show the loading as an
  overlay instead → done (the old diff stays under a light blur with the loading bird).
- 2026-10-30: select text in the diff to copy it, without the `+` and `-` at the start of the
  rows → done (line numbers, markers and hunk headers are not copied; side by side copies one
  side).
- 2026-10-30: sort branches by the date of their last commit too → done (Branches module and
  Settings → Branches).
- 2026-10-30: at start, a loading element over the blurred window while everything loads, then
  the blur clears and the loading element fades out → done (startup curtain).
- 2026-10-30: the loading element is a small flat bird, white on the dark theme and black on the
  light one, singing music notes → done (drawn as an SVG; used by every loading state).
- 2026-11-02 (after the manual checklist):
  - "Open in NoBlame" in the file manager's menu on folders, only when they hold a `.git` →
    phase 2 (T1–T3).
  - Select diff text by dragging from the empty space after the end of a line → done.
  - Repository groups, like bookmark folders, that collapse and expand → done (brought
    forward from M5).
  - Pull all (merge) and Push all on a group; settings for showing those buttons, and Pull and
    Push on single repositories → M5.
  - Choose the graph's columns, for example a relative date ("1 h ago", "3 d ago") instead of
    the date → M3 slice 11.
  - The list jumped up a row when clicking the oldest commit of git.git → fixed.
  - Scrollbars of the app's own, not the system's → done.
  - Closing the right tab of a split switched the left half to another repository → fixed.
  - While Ctrl is held over a commit, say at the pointer that a click compares → done.
  - Ctrl+P opened the print dialog → blocked (it already was in release builds).
  - Move the window while the app starts → done (the start screen drags the window).
  - The number of added, changed and removed files beside each repository in the list, as a
    setting → M4.
  - The mouse pointer stayed hidden after the keyboard-only "Open repository…" → to
    investigate (M3 follow-ups).
- 2026-11-03:
  - Colourful icons: each activity bar module gets a colour that says what it is about (one
    colour for everything about committing, others for other kinds of work) → done (colours as
    theme tokens, easy to change).
  - Colours in the Repositories module for groups, repositories and submodules → done.
  - A round badge with the person's initials, its colour (hue only) computed from the e-mail
    address (owner's choice), so it is the same on every device → done.
  - Repositories inside groups get the same "…" button as open repositories → done; the
    configurable Pull, Push, … buttons come with M5.
- 2026-11-04: pop out the left pane's tabs: right-click a tab → **Pop out**; the module then
  opens as a popup inside the app (not a new window), the rest of the app waits until it is
  closed, its state is kept (a half-written commit message), and a **Dock** button puts it back;
  for every module → done (between M4 slices 3 and 4).
- 2026-11-12: a setting to close a task window once its action succeeded (a commit, a pull, a
  push, …), as TortoiseGit does; the default to be decided → M8 (with slice 5 or 6).
- 2026-11-13, quality of life before M8 slice 5 (all implemented at once):
  - Combine two module tabs into one that shows them one above the other (Commit details over
    Changed files); in the activity bar their icons sit together in a frame → done (also for
    three or more modules).
  - Reorder the activity bar's icons by dragging (combined ones move together); a right-click
    menu to lock the order and to hide icons, which then move under a "…" button above
    Settings → done.
  - A setting for the Commit module's files: the folder before the name, sorted by the whole
    path, or as before (the folder stays grey) → done.
  - Several files chosen at once in the Commit module, as in Windows (Ctrl, Shift, Ctrl+Shift),
    to stage them together → done.
  - Icons in context menus (not every item), coloured by what the item does: in the commit
    graph's menu a branch icon before branches, a globe before remote branches → done (the
    commit graph's and the Branches module's menus).
  - A setting to show the rest of the commit message in the graph, greyed → done.
- 2026-11-16, the owner's notes (owner's answers in brackets):
  - Choosing the working tree row highlights the current branch's history, as choosing HEAD → done.
  - The document tabs remember the order they were used in, also when the layout changes (a
    dock group closes); closing a tab shows the one used last, not the neighbour → done.
  - Bug: staging with Space and then moving with the arrows, the list starts to scroll instead
    of moving to the next file → fixed (focus kept in the list).
  - The graph links a local branch and its upstream: an arrow by the label (ahead or behind)
    selects the other's commit, as Git Extensions does → done.
  - Search in the Files module's tree (a box that filters the whole tree) → done.
  - Submodules follow the main repository (all four): Fetch and Pull include the submodules;
    a setting to update them after pull and checkout; a bar offering to update them when they
    are not on the recorded commits; **Check out the recorded commit** on a changed submodule → done.
  - Search in Settings → done.
  - **Create a branch** in the command palette → done.
  - Bug: the Create a branch dialog sometimes has parts outside it → fixed (all dialogs).
  - Uncommitted file counts for submodules too → done.
  - The Commit module: little height for the two lists, the bottom left part squeezes them;
    in the popped-out module a draggable splitter to see more of the paths; "impress me" → done (splitters, a compact and foldable message area).
  - A submodule's graph labels the commits the main repository's local branches record → done.
