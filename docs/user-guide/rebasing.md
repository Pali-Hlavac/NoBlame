# Rebasing

Rebasing moves the commits you made on your branch so they come after the newest commits of
another branch, as if you had started your work from there. The history stays in one line,
without a merge commit.

## How to rebase

Right-click what you want to rebase onto and choose **Rebase the current branch onto this…**
(on a commit) or **onto it…** (on a branch or tag):

- a commit in the graph;
- a branch, remote branch or tag label on a commit (in its submenu);
- a branch, remote branch or tag in the **Branches** module.

The window lists the commits of your branch that will be moved. They are copied one by one on
top of the other branch and get new ids; the old ones are no longer on your branch.

- **Stash my uncommitted changes meanwhile**: Git puts your uncommitted changes aside and brings
  them back after the rebase. It is ticked for you when you have changes, because Git refuses
  to rebase otherwise.
- **Keep merge commits**: if your branch has merge commits, keep them. Without it they are left
  out and their commits come in one line.

## Editing your commits

Right-click the oldest commit you want to change and choose **Interactive rebase from here…**.
The window lists that commit and every commit after it, oldest first. For each one choose:

- **Pick**: keep it.
- **Reword**: keep it with a new message. A box opens for the message.
- **Edit**: the rebase stops after this commit, so you can change it (amend it in the Commit
  module). Then click **Continue** in the bar.
- **Squash**: fold it into the commit above it, and combine their messages (you can edit the
  combined message).
- **Fixup**: fold it into the commit above it and drop its message.
- **Drop**: leave it out.

Move a commit with its arrows, or with Alt+Up and Alt+Down while its list is focused. Commits
are replayed from the top down in the new order. If you made commits with "fixup! …" or
"squash! …" messages, **Arrange fixup! commits** puts each under the commit it names.

Every commit from the one you chose gets a new id, so the same warning about pushed commits
applies (below). Merge commits in the range are left out; their commits come in one line.

## Commits you already pushed

If some of the moved commits were already pushed, the window says so in red. After the rebase
your branch and the one on the server have different commits, so you have to push with force
(NoBlame offers **force with lease** in the push window). Anyone who built on those commits has
to rebase their work too. When in doubt, merge instead.

## When files conflict

A rebase copies your commits one at a time. If one of them changes lines that are different on
the other branch, the rebase stops there and the bar above the commits says, for example,
"Rebasing topic (step 2 of 3)".

1. Click **Resolve…** in the bar and resolve the files, as for a
   [merge](merging.md#when-files-conflict). During a rebase the roles swap: **ours** is the
   branch you rebase onto, **theirs** is your own commit being moved.
2. Click **Continue**. The rebase goes on with the next commit. It can stop again at a later
   commit; NoBlame tells you.

**Skip** leaves out the commit it stopped at. **Abort** puts your branch back as it was before
the rebase.

If your stashed changes conflict when they come back at the end, the rebase is still done: fix
the conflict markers in your files. The changes are also kept in the stash list, so nothing is
lost.
