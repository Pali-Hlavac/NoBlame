# The commit graph

Every repository tab shows the repository's history: one row per commit, newest first. A commit
is never shown below the commits it came from.

## Columns

- **Graph**: the branches as coloured lines and each commit as a dot.
- **Message**: labels for branches and tags, then the first line of the commit message.
- **Author** (hover to see the e-mail address), **Date** and **Commit** (the start of the commit
  id).

## Reading the graph

- Each branch line keeps its colour along its whole length.
- A hollow dot is a merge: the commit joins two or more lines.
- The commit you have checked out has a yellow ring, and its branch label is outlined.
- Green labels are your local branches, blue labels are branches on a remote (such as
  `origin/main`), amber labels are tags. A yellow **HEAD** label means you are not on a branch.

Very wide histories are cut at 16 lines; the commits are all still there.

## Selecting and moving

- Click a commit to select it.
- Click the list (or move to it with **Tab**) and use the keyboard:
  - **Up / Down**: previous or next commit;
  - **Page Up / Page Down**: one screen up or down;
  - **Home / End**: newest or oldest commit.
- Right-click a commit (or press **Shift+F10**) for its menu: copy its id, subject or message,
  highlight its history, [compare it with HEAD](compare.md), or copy a branch or tag name. The menu also lists what is coming, such
  as creating a branch or cherry-picking; those entries are greyed out and say in which version
  they arrive.
- Hold **Ctrl** (**Cmd** on macOS) and click a second commit to [compare](compare.md) it with
  the selected one.
- When you open a repository, the commit you have checked out is selected.
- NoBlame remembers the selected commit and where you scrolled when you switch tabs.

If you have changes you have not committed yet, one or two extra rows appear above the newest
commit: **Working tree changes** (files you changed, new files, conflicts) and **Staged
changes** (files ready to commit). Select one to see the counts in Commit details. Lists of the
files and staging come in a later version. In **Settings → Commit graph** you can show a short
summary in the repository header instead, or hide them. NoBlame checks again whenever you come
back to the window.

When you select a commit, NoBlame highlights it:

- the commit's history stays bright: the commits it was built on and the lines leading into it,
  including branches merged into it. Everything else fades.
- the commits by the same author are tinted, with the author's name in bold.

Press **Esc** in the list to clear the highlight; the commit stays selected. You can switch the
highlight off in **Settings → Commit graph**.

To see the files a commit changed and their diffs, see [Viewing changes](viewing-changes.md).

## Finding a commit

- Press **Ctrl+F** to find commits by id, branch or tag name, author, or words in the message.
  NoBlame jumps to the first match from the selected commit on and shows, for example, "3 of 120".
  - **Enter** goes to the next (older) match, **Shift+Enter** to the previous (newer) one.
  - **Esc** closes the find bar.
- Press **Ctrl+Shift+G** to go straight to a commit: type its id (the first few characters are
  enough), a branch or tag name, or `HEAD~2`.
  - If a filter hides that commit, NoBlame offers to show all commits and go there.

Both search only the commits the tab shows (with a filter on, the filtered ones). In very large
repositories the first search for a word takes a second or so.

## Showing fewer commits

The bar above the list chooses which commits the tab shows:

- **All branches** opens a list: pick **Current branch** to see only the history of the branch
  you are on, or pick any branch or tag (type to find it).
- **First parent** shows only the main line of each branch: merged branches are reduced to their
  merge commit.
- **No merges** hides merge commits.
- **Message** shows the commits whose message contains what you type, and **Author** the
  commits whose author's name or e-mail contains it. Upper and lower case do not matter. The
  search starts when you stop typing, or when you press **Enter**; **Esc** empties the field.
- **Path** shows only the commits that changed a file or folder, for example `src/` or
  `README.md`. Write it relative to the repository's top folder, or paste the full path of a file
  inside the repository. `*.rs` finds every Rust file.

You can combine them. While a filter is on, the bar says how many commits are shown, for example
"1,234 of 56,789 commits". Click **Clear** to see all commits again.

Lines still connect each commit to the nearest commit it came from, skipping hidden ones. The
filter stays while the tab is open, and is reset when you close the tab.

In very large repositories, searching messages or authors takes a second or two.

To see every commit that changed one file, even across renames, see
[File history](file-history.md); to see who changed each line, see [Blame](blame.md).

## Large repositories

NoBlame reads only what is on screen, so even a history with a million commits opens in about a
second. In very long histories the scroll bar is compressed, so the mouse
wheel moves faster than usual. If NoBlame suggests writing a commit-graph file, accept it: it
makes loading much faster ([Opening repositories](opening-repositories.md)).

## Empty repositories

A new repository without commits shows "No commits yet".
