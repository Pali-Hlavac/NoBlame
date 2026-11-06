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
- [ ] **(new)** Right-click a module's tab → **Pop out**: it leaves the sidebar and opens in a
      popup; nothing behind it reacts. Close it (×, Esc), open it again from its icon or Alt+N:
      it is the popup again, with what you typed still there. **Dock** puts it back in the
      sidebar. Restart: a popped-out module stays popped out.
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
- [ ] (new, M4 slice 7) Settings → Repositories → **Show the number of uncommitted files beside
      repositories**. Edit a file and create one in an open repository: its row shows `+1 ~1`
      within a moment. Change a file of a repository under Recent or in a group in a terminal,
      switch back to NoBlame: its count appears. Pointing at the numbers names them. Switch the
      setting off: the numbers go.
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
- [ ] (new, M5 slice 1) Right-click a branch: **Check out** switches (the title bar follows).
      Change a file that differs between two branches and check out the other: the toast shows
      git's message and nothing changes.
  - Notes:
- [ ] (new, M5 slice 1) Right-click a remote branch → **Check out as a new local branch…**: the
      name is suggested; afterwards `git branch -vv` shows it tracking the remote branch.
  - Notes:
- [ ] (new, M5 slice 1) **F2** on a branch renames it (typing an existing name is refused at
      once). **Delete** on a branch with commits of its own lists them before deleting.
  - Notes:
- [ ] (new, M5 slice 1) In the graph's commit menu: **Create a branch here…**, **Create a tag
      here…** (with a message: annotated), **Check out this commit…** (explains detached HEAD).
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
- [ ] **(new, M4)** In NoBlame itself, change a file, stage another (`git add` in a terminal)
      and add a new file. Select **Working tree changes**: the changed (M) and new (?) files are
      listed; select **Staged changes**: the staged one is.
  - Notes:
- [ ] **(new, M4)** Choose a changed file: its diff shows the edits you have not staged. Edit and
      save it in your editor: the diff updates without clicking anything.
  - Notes:
- [ ] **(new, M4)** A new file shows all lines added; a changed image shows before and after.
  - Notes:

## 13a. Committing (new, M4 slice 2)

Use a scratch repository, or a branch you can throw away.

- [ ] Toolbar **Commit**: the Commit module opens in the sidebar with **Changes** and **Staged**.
  - Notes:
- [ ] Click a file: its diff shows in the Diff tab and the matching row is selected in the graph.
  - Notes:
- [ ] Point at a file, click **+**: it moves to Staged and the next file is shown. Space on the
      active row does the same; **−** and Space in Staged move it back.
  - Notes:
- [ ] A renamed, staged file (`git mv`): **−** unstages both names.
  - Notes:
- [ ] **Stage all** / **Unstage all**. With a merge conflict, Stage all asks before marking the
      file resolved.
  - Notes:
- [ ] Write a message, Ctrl+Enter: the commit appears in the graph, the box empties and git's
      summary line shows.
  - Notes:
- [ ] A failing hook (e.g. a `commit-msg` hook that exits 1): its message shows in red, the
      message is kept, nothing is committed.
  - Notes:
- [ ] Tick **Amend last commit**: the last message is filled in; untick: it goes away. Amend
      with a new message: the graph shows the replaced commit.
  - Notes:
- [ ] **Sign off** adds `Signed-off-by:` with your name; with `commit.gpgSign` on, the commit is
      signed (Commit details says so).
  - Notes:
- [ ] Pop out the **Commit** tab: Commit opens a popup with the diff beside the lists; Esc
      closes it, the message is kept; after a commit it closes with a toast.
  - Notes:
- [ ] A repository's **…** → **Commit…** (also for a closed one in a group) shows it and opens
      the commit window.
  - Notes:
- [ ] **(slice 4)** **Recent ▾** lists your last messages (not other people's); choosing one
      replaces the box.
  - Notes:
- [ ] **(slice 4)** With `git config commit.template .gitmessage` (a file with `#` lines): the box
      starts with it; Commit waits until it is changed; the commit has no `#` lines; after the
      commit the template is back. Amend over it fills in the last message; untick: the template
      returns.
  - Notes:
- [ ] **(slice 4)** **Author → Change**: `Grace` is refused, `Grace <g@example.com>` commits with
      her as the author and you as the committer (Commit details); the next commit is yours.
  - Notes:
- [ ] **(slice 4)** A 60-character summary shows 60/50 in amber, 80 in red; text on line 2 shows
      **Leave line 2 empty**.
  - Notes:

- [ ] **(slice 3)** In a changed file's diff: **Stage hunk** stages only that hunk (the file is
      then in both lists); **Unstage hunk** in the staged diff takes it back.
  - Notes:
- [ ] **(slice 3)** Click two changed lines' numbers (or click and Shift+click): the bar says
      "2 lines chosen"; **Stage 2 lines** stages exactly those.
  - Notes:
- [ ] **(slice 3)** **Discard hunk…** and **Discard…** ask first, then the file loses only those
      changes (line endings as before).
  - Notes:
- [ ] **(slice 3)** **↶** on a changed file asks, then puts back the staged version; on a new file
      it says the file is deleted. **↶** in the Changes header lists what is lost.
  - Notes:

- [ ] **(slice 6)** Create `a.log` and `logs/b.log` in a scratch repository. Point at `a.log` in
      Changes → crossed-out eye **Ignore…**: **Only this file** is picked and "Hides 1 file";
      **Every .log file** hides both. **Ignore** → both leave the list, `.gitignore` shows as
      changed with `*.log` as its last line.
  - Notes:
- [ ] **(slice 6)** Ignore a file into `.git/info/exclude`: it leaves the list, nothing new is
      listed. Type `#x` as the pattern: the dialog says why it cannot be used.
  - Notes:

## 13b. Stashes (new, M4 slice 5)

Use a scratch repository with a few changed files and one new file.

- [ ] Stashes → **Stash changes…**: every changed file is ticked; untick one, write a message,
      **Stash**: only the ticked files go back to their committed version; the stash is
      `stash@{0}` with your message.
  - Notes:
- [ ] **Include new files** lists the new file; stashing removes it from the folder.
  - Notes:
- [ ] Click a stash: the Stash tab opens beside the graph with its files (new ones marked **?**);
      a file shows its diff.
  - Notes:
- [ ] **Apply** brings the changes back and keeps the stash; **Pop** also removes it. With your
      own change in one of its files: nothing happens and the message names the file.
  - Notes:
- [ ] Tick one file, **Apply 1 chosen**: only that file changes (unstaged); the stash stays.
      Commit something in that file first, then apply: both changes are in it (or conflict
      markers when they touch the same lines).
  - Notes:
- [ ] **Drop…** asks, naming the stash; after Drop it is gone from the list.
  - Notes:
- [ ] The graph labels the commit each stash was made on `stash@{n}` (amber, box icon); a stash
      made in a terminal appears there within a second, the older labels renumbered.
  - Notes:
- [ ] Make a stash in a terminal while NoBlame shows the list, then drop the old `stash@{0}`
      from NoBlame without refreshing: it refuses ("changed since the list was shown").
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
- [ ] **(not checked yet)** Command palette → **Compare branches or commits…**.
  - Notes:
- [ ] (new, M4 slice 6) With no `diff.tool` in your Git config, click the window icon beside a
      file's name in the Diff tab: "Git has no diff tool set". Choose **Visual Studio Code** in
      Settings → Diff and click again: VS Code shows both versions; for an uncommitted file the
      right side is the file itself.
  - Notes:
- [ ] (new, M4 slice 6) Edit a file, then right-click an older commit → **Compare with the
      working tree**: the right side says **Working tree**, ⇄ is greyed out, the edited file is
      listed with your change in its diff. Save the file again with another change:
      the list and diff update within a second.
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

## 19. Colours and badges (new, 2026-11-03)

- [ ] Activity bar, toolbar and command palette icons are coloured by kind (green committing,
      amber stashes, teal history, violet branches and remotes, blue repositories), in light and
      dark.
  - Notes:
- [ ] Repositories module: orange group folders, blue repositories, purple submodules.
  - Notes:
- [ ] Initials badges beside authors in the commit list and in Commit details; the same person
      always has the same colour.
  - Notes:
- [ ] Point at a repository inside a group: its **…** button offers Open (or Close when open),
      Copy path and Remove from group.
  - Notes:

## Known issues to watch for

- [ ] Once, after a hot reload during development, opening a tab threw "invalid location" and
      the window went blank. Tell me if it ever happens without a hot reload.
  - Notes:
