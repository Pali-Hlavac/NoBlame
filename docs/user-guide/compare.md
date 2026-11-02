# Comparing branches and commits

The **Compare** tab shows every file that differs between two branches, tags or commits, and
what changed in each one.

## Opening it

- In the graph, right-click a commit and choose **Compare with HEAD**. This shows what changed
  from that commit to the commit you have checked out.
- Right-click a commit that has a branch or tag, open the branch's or tag's submenu, and choose
  **Compare with the current branch**.
- Click a commit, then hold **Ctrl** (**Cmd** on macOS) and click another one. The first click
  stays selected; the tab compares the two, from the lower one in the graph (usually the older)
  to the upper one.
- Open the command palette (Ctrl+K) and choose **Compare branches or commits…**.

## Choosing what to compare

The two buttons at the top are the two sides, from the left one to the right one. Click one to
pick:

- **HEAD**, a branch, a remote branch or a tag (type to narrow the list);
- or anything Git understands: type it and choose **Use "…"**. For example, a commit id,
  `HEAD~3` (three commits back) or `v1.0^`.

The **⇄** button swaps the two sides.

**Only changes since they split** shows only what the right side changed since the two went
their separate ways. Use it to see what a feature branch adds, without the changes made on the
main branch meanwhile.

The line below tells how many files differ, how many commits only each side has, and, with the
option on, the commit where they split.

## Looking at a file

Click a file in the list, or move through the list with the arrow keys. Its changes appear on the
right, with the same options as the **Diff** tab: unified or side by side, whitespace, context
lines. Drag the line between the list and the diff to resize them.

The file stays chosen when you compare other branches, as long as it differs there too.

## Good to know

- A branch is compared where it is now: after a commit or a fetch, the tab updates.
- Comparing even very different versions takes under a second, also on the Linux kernel.
- At most 100,000 files are listed.
- In a partial clone (one that downloads old file contents only when needed), a file that was
  both moved and edited is shown as deleted and added. NoBlame does not download anything for
  this.
- Comparing with your uncommitted changes comes later, with committing.
