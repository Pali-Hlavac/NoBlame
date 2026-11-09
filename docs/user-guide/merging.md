# Merging

Merging brings the commits of another branch into the branch you are on.

## How to merge

Right-click what you want to merge and choose **Merge into the current branch…**:

- a branch, remote branch or tag in the **Branches** module;
- a branch or tag label on a commit in the graph (in its submenu);
- any commit in the graph.

Then choose how:

- **Fast-forward when possible** (the usual choice): if your branch has no commits of its own
  since the other one split off, it simply moves forward. Otherwise a merge commit joins the two.
- **Always create a merge commit**: keeps a visible record that the branch was merged.
- **Fast-forward only**: merges only when no merge commit is needed, otherwise does nothing.
- **Squash**: puts all the changes of the other branch into your files and stages them, without
  committing. You then commit them yourself as one commit.

A message tells you what happened. If you have uncommitted changes that the merge would
overwrite, nothing is merged; commit or stash them first.

## When files conflict

If both branches changed the same lines, Git cannot merge those files by itself and the merge
stops. A bar appears above the commits: "Merging: Merge branch 'topic'", with how many files
still conflict.

1. Open each conflicted file (they are marked **U** in Changed files and in the Commit module)
   and edit it to keep what is right. Remove the `<<<<<<<`, `=======` and `>>>>>>>` lines.
2. Stage the file.
3. When no conflicts are left, click **Continue** in the bar. NoBlame commits the merge with
   Git's message.

Click **Abort** to give up: your branch and files go back to how they were before the merge, and
any conflict fixes you made are lost. NoBlame asks first.

The same bar appears for a [rebase](rebasing.md), [cherry-pick or revert](cherry-pick-revert-reset.md) that
stopped, also when you started it in a terminal or by pulling. There, **Skip** leaves out the
commit it stopped at.
