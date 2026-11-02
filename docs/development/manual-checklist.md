# Manual test checklist

Everything built so far (M1 to M3 slice 9), to click through in the running app. Tick a box when
it works; write what you notice after `Notes:` under it (or paste the item into the chat).

Items marked **(not checked yet)** were never tried in the running app by the agent; please look
at those first. Items marked **(new)** come from your notes of 2026-11-02.

## Test repositories

| Repository                                    | Good for                                                        |
| --------------------------------------------- | --------------------------------------------------------------- |
| NoBlame itself (this folder)                  | Everyday checks, images in diffs (`assets/logo/*.png` commits)  |
| `.cache/repos/git` (git.git, 82k commits)     | File history with renames, blame, the commit-graph offer        |
| `.cache/repos/linux` (1.5M commits, blobless) | Speed, wide graphs, "not in the local repository" messages      |
| `.cache/repos/synthetic-1m`                   | A million commits, filters and find                             |
| `.cache/repos/demo-submodules`                | Submodules (nested, not initialized)                            |
| A new empty folder                            | Create repository, "no commits yet", changes made in a terminal |

## 1. Start and window

- [ ] Start the app: a singing bird shows at once, then the window appears blurred behind it and
      clears.
  - Notes:
- [ ] **(new)** While the bird shows at start, drag anywhere on the window: it moves.
  - Notes:
- [ ] Drag the empty part of the title bar to move the window; double-click it to maximize;
      minimize, maximize and close buttons at the right.
  - Notes:
- [ ] Status bar → **Theme**: System, Light, Dark. Restart: the theme is kept and the window
      never flashes white.
  - Notes:
- [ ] Status bar shows the git version; hover for its path; click it to check again.
  - Notes:
- [ ] Ctrl+K → **About NoBlame**: version, platform, git path.
  - Notes:
- [ ] Close the app with tabs and modules rearranged; start it again: everything is where you
      left it. Ctrl+K → **Reset layout** puts the modules back and keeps the tabs.
  - Notes:

## 2. Welcome tab and opening repositories

- [ ] Welcome tab → **Open repository…** → pick a subfolder of a repository (for example
      `NoBlame\src`): the whole repository opens.
  - Notes:
- [ ] Open the same repository again: it switches to the existing tab.
  - Notes:
- [ ] **Open repository…** on a folder that is not a repository: "… is not a Git repository"
      with **Create a repository here**.
  - Notes:
- [ ] **Create repository…** in an empty folder: the tab says "no commits yet" and the graph
      says "No commits yet".
  - Notes:
- [ ] Recent repositories: newest first; a moved or deleted folder is dimmed; hover → **×**
      removes it.
  - Notes:
- [ ] Close every tab: **Open Welcome tab** brings it back.
  - Notes:
- [ ] Open `.cache/repos/git`: the notice "History loads much faster with a commit-graph file"
      appears. **Write commit-graph** runs while you keep working; **×** hides the notice.
  - Notes:
- [ ] Open `.cache/repos/demo-submodules`: the header shows labels such as **Submodule**;
      a submodule tab shows its own.
  - Notes:

## 3. Command line

Use `target\debug\noblame.exe` while the dev app runs.

- [ ] `noblame.exe <path of a repository>`: the running app opens a tab for it.
  - Notes:
- [ ] `noblame.exe commit <path>`: a small placeholder window naming the task, the path and its
      milestone.
  - Notes:
- [ ] `noblame.exe --help`, `noblame.exe commit --help`, `noblame.exe --version`.
  - Notes:

## 4. Workbench layout and keyboard

- [ ] Click each activity bar icon: its module shows. Click the icon of the module already
      shown: the sidebar hides; click any icon to bring it back.
  - Notes:
- [ ] Drag the line between the sidebar and the tabs; drag a module's tab next to another or to
      an edge.
  - Notes:
- [ ] Drag a document tab (the graph, Diff, File) to an edge of the tab area to split it.
  - Notes:
- [ ] **(new)** Split: several repository tabs on the left (show one that is not the last),
      Diff alone on the right. Close the Diff: the left keeps showing the same repository.
  - Notes:
- [ ] **(not checked yet)** On a real keyboard: Alt+1 … Alt+6 open Repositories, Branches,
      Commit details, Stashes, Changed files, Files. (Simulated key presses did not switch
      modules.)
  - Notes:
- [ ] **(not checked yet)** F6 / Shift+F6 move between activity bar, sidebar, toolbar, tabs and
      status bar.
  - Notes:
- [ ] Ctrl+Tab / Ctrl+Shift+Tab switch tabs; Ctrl+W closes the current tab.
  - Notes:
- [ ] Ctrl+, (or the gear at the bottom of the activity bar) opens Settings.
  - Notes:

## 5. Toolbar

- [ ] **Pull ▾** (Fetch, Fetch all remotes, Fetch and prune), **Push**, **Commit** are greyed
      out; hovering says which version brings them.
  - Notes:
- [ ] **Stashes** opens the Stashes module; the magnifier opens the command palette.
  - Notes:
- [ ] The title bar shows the active repository's name and branch.
  - Notes:

## 6. Repositories module (Alt+1)

- [ ] `demo-submodules`: submodules nested under the repository; an uninitialized one is grey;
      clicking one opens it in its own tab and it turns bold.
  - Notes:
- [ ] Hover an open repository → **…**: **Copy path**, **Close** work; Pull, Fetch, Push,
      Commit are listed as later.
  - Notes:
- [ ] Settings → switch off the **…** button: it disappears.
  - Notes:
- [ ] **(new)** Click a section title (Open, Groups, Recent): it folds. Drag a title onto
      another section to reorder; Alt+Up / Alt+Down on a title does the same. Restart: kept.
  - Notes:
- [ ] **(new)** Groups: the **New group** button at the top → type a name, Enter. F2 on a group
      renames it; Escape cancels.
  - Notes:
- [ ] **(new)** A repository with submodules in a group (for example `demo-submodules`): its
      submodules show below it, also while it is not open.
  - Notes:
- [ ] **(new)** Drag an open or recent repository onto a group; right-click a repository →
      **Add to group** → a group, or **New group…**.
  - Notes:
- [ ] **(new)** Drag repositories within a group and between groups; drag a group onto another
      to reorder (or **…** → Move up / Move down). Click a group to fold it; restart: everything
      is kept.
  - Notes:
- [ ] **(new)** A group's **…** → **Open all**; **Pull all** / **Push all** are greyed out (M5);
      **Delete group…** asks first and leaves the repositories alone.
  - Notes:

## 7. Branches module (Alt+2)

- [ ] Type in the filter; fold a section by clicking its title; HEAD is marked.
  - Notes:
- [ ] Click a branch or tag: its commit is selected in the graph.
  - Notes:
- [ ] The sort button: by name / by last commit (with dates). Restart: the choice is kept (also
      in Settings → Branches).
  - Notes:
- [ ] With a graph filter on (section 12), branches whose commit is hidden are dimmed.
  - Notes:

## 8. Commit details (Alt+3) and Stashes (Alt+4)

- [ ] Select a commit: message, id with a copy button, parents (click one to select it), author
      and committer with their time zones, labels, **Contained in**.
  - Notes:
- [ ] **(new)** A commit with a branch made from it: **Children** lists the commits on top of it;
      click one to select it.
  - Notes:
- [ ] **(new)** A signed commit (git.git has GPG-signed ones; your own if you sign): the
      **Signature** row says whether it is good, who signed it and the key; without the
      signer's key it says it could not be checked, with gpg's message.
  - Notes:
- [ ] In a terminal: `git stash` in a test repository, switch back to NoBlame: the Stashes list
      updates.
  - Notes:

## 9. Commit graph

- [ ] **(new)** Right-click the column titles (or the columns button at their right end): hide
      Author, show dates as "Time since"; hover a date for the full date. Reset columns.
  - Notes:
- [ ] **(new)** Drag the Date title before Message; drag the edge of the Author title wider;
      double-click the edge: back to the usual width. Restart: the columns are kept.
  - Notes:

- [ ] Columns: graph, message with branch and tag labels, author (hover for e-mail), date, id.
      Merges are hollow dots; the checked-out commit has a yellow ring.
  - Notes:
- [ ] Click a commit, then Up/Down, Page Up/Down, Home/End.
  - Notes:
- [ ] **(new)** git.git: scroll to the very end and click the oldest commit: the list does not
      move.
  - Notes:
- [ ] **(new)** Scrollbars everywhere are thin and in the theme's colours (graph, lists, diff).
  - Notes:
- [ ] Selecting a commit brightens its history and tints commits by the same author; Esc clears
      the highlight. Settings → Commit graph switches the highlight off.
  - Notes:
- [ ] Linux: scroll from top to bottom quickly; wide parts are cut at 16 lines.
  - Notes:
- [ ] Switch to another tab and back: selection and scroll position are kept.
  - Notes:
- [ ] Edit a file in a test repository: a **Working tree changes** row appears above the newest
      commit; `git add` it: **Staged changes** appears. Settings → Commit graph: show a summary in
      the header instead, or hide them.
  - Notes:
- [ ] In a terminal: commit, switch branch, fetch: the graph updates by itself within a moment
      and the selection stays on its commit.
  - Notes:

## 10. Commit context menu

- [ ] Right-click a commit (or Shift+F10): copy full id, short id, subject, whole message;
      highlight its history; copy a branch or tag name.
  - Notes:
- [ ] Later entries (create branch, cherry-pick, …) are greyed out with their version.
  - Notes:
- [ ] **Browse files at this commit** opens the Files module at that commit.
  - Notes:

## 11. Find and go to commit

- [ ] Ctrl+F, type `fix` (or an author): "3 of 120"-style count; Enter = older match,
      Shift+Enter = newer; Esc closes.
  - Notes:
- [ ] Ctrl+Shift+G: type `HEAD~2`, a branch name, the first characters of an id: the graph jumps
      there.
  - Notes:
- [ ] With a filter that hides the commit: it offers to show all commits and go there.
  - Notes:

## 12. Graph filters

- [ ] **All branches** → **Current branch**; then pick another branch or tag (type to find it).
  - Notes:
- [ ] **First parent**; **No merges**.
  - Notes:
- [ ] **Message** `fix`, **Author** `torvalds` (Linux): applies after you stop typing or on
      Enter; Esc empties the field.
  - Notes:
- [ ] **Path** `src/`, `README.md`, `*.rs`, and a full path pasted from Explorer.
  - Notes:
- [ ] The bar says "N of M commits"; **Clear** shows everything; filters combine; the selected
      commit stays selected when the filter shows it.
  - Notes:

## 13. Changed files (Alt+5) and the Diff tab

- [ ] Select a commit: files with A, M, D (struck through), R (old name shown), C.
  - Notes:
- [ ] A merge: **Compared with** parent 1 / parent 2.
  - Notes:
- [ ] Click a file or move with the arrows: the Diff tab opens beside the graph and switches
      files in place.
  - Notes:
- [ ] **Unified** / **Side by side**; scroll sideways in side by side (bar, Shift+wheel, arrows).
  - Notes:
- [ ] **Whitespace** modes; on a re-indent commit the tab says only whitespace changed.
  - Notes:
- [ ] **Context −/+** and **Whole file** (click again to go back); the line in the middle stays
      in place.
  - Notes:
- [ ] Changed words in an edited line are marked stronger; code is coloured (Settings → Diff
      switches colours off).
  - Notes:
- [ ] Drag over lines, Ctrl+C: only code, no line numbers or `+`/`-`.
  - Notes:
- [ ] **(new)** Start the drag in the empty space after the end of a line (also in the File
      tab).
  - Notes:
- [ ] NoBlame: a commit changing `assets/logo/*.png` shows before and after pictures.
  - Notes:
- [ ] Select another commit that changed the same file: the Diff tab keeps showing it.
  - Notes:
- [ ] Linux: an old file's diff says the version is not in the local repository.
  - Notes:

## 14. Files (Alt+6) and the File tab

- [ ] Select a commit: its folders and files; click a folder or Enter to open; Right opens or
      moves in, Left closes or moves up.
  - Notes:
- [ ] Linux: open `include/linux` (1,600 entries): appears almost at once.
  - Notes:
- [ ] Click a file: the File tab shows it with line numbers and colours; a picture shows as a
      picture.
  - Notes:
- [ ] Select another commit: open folders stay open, the File tab shows the same file there, or
      says that commit does not have it.
  - Notes:
- [ ] Right-click a row: Show / Open / Close, Copy path, Copy name.
  - Notes:
- [ ] **(not checked yet)** **Save as…** (File tab button or right-click): the save dialog
      proposes the name; the saved file is byte for byte the repository's version (a file with
      CRLF stays CRLF).
  - Notes:

## 15. File history (new in slice 8)

- [ ] **(not checked yet)** git.git → Files → `builtin/log.c` → right-click → **File
      history**: a **History** tab beside the graph, about 863 commits, "Earlier name:
      builtin-log.c", in about a second.
  - Notes:
- [ ] **(not checked yet)** Click rows and move with the arrows: the commit is selected in the
      graph, and the Diff tab shows that commit's change to the file (under its old name for old
      commits).
  - Notes:
- [ ] **(not checked yet)** File tab → **History** button does the same for the shown file.
  - Notes:
- [ ] **(not checked yet)** Right-click a folder (`Documentation`) → **Folder history**:
      clicking a row only selects the commit.
  - Notes:
- [ ] **(not checked yet)** Select a commit in the graph that is in the history: the History
      list moves its cursor to it.
  - Notes:
- [ ] **(not checked yet)** Filter the graph to one branch: the header says "on the branch the
      graph shows"; a Message filter makes hidden commits faded and not selectable.
  - Notes:
- [ ] **(not checked yet)** Linux → `kernel/sched/core.c` history: a note says earlier names
      are not followed because the clone lacks the contents. `MAINTAINERS`: "Reading the
      history…" for about 9 s, then 22,019 commits.
  - Notes:

## 16. Blame (new in slice 8)

- [ ] **(not checked yet)** git.git → Files → `builtin/log.c` → right-click → **Blame**: a
      **Blame** tab; beside each group of lines the short id, date, author and summary; a bar
      stronger for recent changes.
  - Notes:
- [ ] **(not checked yet)** Click a commit in the gutter: it is selected in the graph; the
      Blame tab stays as it is.
  - Notes:
- [ ] **(not checked yet)** Right-click a commit → **Show the change**: Diff tab with that
      commit's change to the file.
  - Notes:
- [ ] **(not checked yet)** Right-click → **Blame the previous revision** a few times (try a
      line from before the 2010 move: it switches to `builtin-log.c`), then **Back** step by
      step.
  - Notes:
- [ ] **(not checked yet)** Right-click → **Copy commit id**; File tab → **Blame** button.
  - Notes:
- [ ] **(not checked yet)** Blame a commit the graph's filter hides, then click it: a message
      says the filter hides it.
  - Notes:
- [ ] **(not checked yet)** Linux: blame any file: an error from git, and nothing is
      downloaded.
  - Notes:

## 17. Compare two revisions (new in slice 9)

- [x] git.git → right-click an older commit → **Compare with HEAD**: a **Compare** tab beside
      the graph (with the Diff tab), the files that differ, and "N files differ · N commits only
      in …".
  - Notes:
- [x] Click a file in the list (or use the arrows): its diff on the right, with the diff
      options. Drag the divider between list and diff.
  - Notes:
- [x] Click the right side's button, type `v2.40.0`, choose **Use "v2.40.0"**; then pick a
      branch from the list on the left side.
  - Notes:
- [x] **⇄** swaps the sides; **Only changes since they split** adds "split at …" and lists only
      the right side's changes.
  - Notes:
- [~] Click a commit, then **Ctrl+click** another: the selection stays, the Compare tab
  compares them (the lower one in the graph on the left).
  - Notes: Add a tooltip on cursor while holding ctrl and hovering another commit that indicates "compare"
  - Done: hold Ctrl over another commit: "Click to compare with <id> <subject>" at the pointer."
- [x] A commit with a branch or tag → its submenu → **Compare with the current branch**.
  - Notes:
- [x] **(not checked yet)** Type a name that does not exist (`no-such-branch`): an error with a
      hint.
  - Notes:
- [x] **(not checked yet)** Linux: compare `v4.0` with `HEAD`: about a second, 116,665 files;
      `v7.2` → `v7.3` shows the partial-clone note about renames.
  - Notes:
- [ ] **(not checked yet)** Command palette → **Compare branches or commits…**; **Compare with
      the working tree** is greyed out (M4).
  - Notes:

## 18. Command palette and Settings

- [~] Ctrl+K: Open / Create repository, Open Welcome tab, Close current tab, themes, Check git
  installation again, About; with a repository tab active, "Open … window" task commands
  (placeholders).
  - Notes: mouse cursor diappears on typing - when system file explorer opens (open repository, using only keyboard) the mouse doesn't appear back when moving it
- [ ] Settings: theme, commit highlight, working-tree rows, repository **…** button, Diff
      (layout, whitespace, context, colours), Branches sort. Each change applies at once and is
      kept after a restart.
  - Notes:

- [ ] **(new)** Ctrl+P does nothing (no print dialog), also in the dev app.
  - Notes:

## Known issues to watch for

- [ ] Once, after a hot reload during development, opening a tab threw "invalid location" and
      the window went blank. Tell me if it ever happens without a hot reload.
  - Notes:
