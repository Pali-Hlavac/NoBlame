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

Click **Resolve…** in the bar. A window lists the conflicted files and says who is who:
**ours** is your branch, **theirs** is the branch you merge. For each file:

- **Merge tool** opens the file in your merge tool, with both versions side by side. Resolve it
  there, save and close the tool: Git then marks the file resolved. Choose the tool in
  **Settings → Diff → Merge tool for conflicts** (Git's own setting, Visual Studio Code, Beyond
  Compare, KDiff3, Meld, P4Merge, or another tool Git knows).
- **Use ours** or **Use theirs** keeps that whole version of the file and drops the other.
  Where one side deleted the file, the button says **(delete)**.
- **Mark resolved**: when you fixed the file yourself in an editor (removing the `<<<<<<<`,
  `=======` and `>>>>>>>` lines), this marks it resolved.

**Use ours for all** and **Use theirs for all** do it for every file at once. In the Commit
module, right-click a conflicted file (marked **U**) for **Open in merge tool** and **Resolve
conflicts…** too.

When no conflicts are left, click **Continue** in the bar. NoBlame commits the merge with
Git's message.

Click **Abort** to give up: your branch and files go back to how they were before the merge, and
any conflict fixes you made are lost. NoBlame asks first.

The same bar appears for a [rebase](rebasing.md), [cherry-pick or revert](cherry-pick-revert-reset.md) that
stopped, also when you started it in a terminal or by pulling. There, **Skip** leaves out the
commit it stopped at.
