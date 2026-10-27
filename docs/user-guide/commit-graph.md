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
- When you open a repository, the commit you have checked out is selected.
- NoBlame remembers the selected commit and where you scrolled when you switch tabs.

Commit details and changes come in a later version.

## Large repositories

NoBlame reads only what is on screen, so even a history with a million commits opens in about a
second. In very long histories the scroll bar is compressed, so the mouse
wheel moves faster than usual. If NoBlame suggests writing a commit-graph file, accept it: it
makes loading much faster ([Opening repositories](opening-repositories.md)).

## Empty repositories

A new repository without commits shows "No commits yet".
