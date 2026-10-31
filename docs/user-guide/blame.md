# Blame

The **Blame** tab shows a file with, beside each line, the commit that last changed that
line: who changed it, when, and why.

## Opening it

- In **Files** (Alt+6), right-click a file and choose **Blame**.
- In the **File** tab, click **Blame**.

Both blame the file as it is in the commit you have selected. The Blame tab stays on that
version when you select other commits.

## Reading it

Lines changed by the same commit are grouped. The first line of each group shows the commit's
short id, date, author and summary. Hover over it to see the full details. The bar on the left
is darker for recent changes and lighter for old ones.

## Following a line back in time

Click a commit to select it in the graph. **Commit details** and **Changed files** then show
it.

Right-click a commit for more:

- **Show the change**: shows what that commit changed in this file, in the **Diff** tab.
- **Blame the previous revision**: shows the file as it was just before that commit, so you can
  see who wrote the line before. Use it again to go further back.
- **Copy commit id**.

**Back** returns to the version you looked at before.

## Good to know

- Blame uses your installed Git, so it follows your Git settings, such as a list of commits to
  ignore (`blame.ignoreRevsFile`) and the names in `.mailmap`.
- A large file with a long history can take a second or two.
- In a partial clone (one that downloads old file contents only when needed), blame needs
  contents that are not on your computer yet. NoBlame does not download them, so the blame
  shows an error instead.
