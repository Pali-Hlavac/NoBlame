# Getting lost work back (the reflog)

Git remembers where your branch pointed before each change: every commit, checkout, reset,
merge and rebase. So after a reset or a rebase that went wrong, your old commits are usually
still there for a while, even when no branch shows them any more.

## The Reflog module

Open **Reflog** in the activity bar (Alt+8). It lists what happened, newest first:

- the commit's short id;
- what Git did, such as **commit**, **checkout**, **reset** or **rebase (finish)**;
- the rest of Git's words, such as "moving from main to topic";
- how long ago.

At the top you choose whose history you see: **HEAD (everything you did)**, or one of your
branches.

Click an entry to select its commit in the graph. If no branch has that commit any more,
NoBlame tells you: only the reflog still has it.

## Restoring a state

Right-click an entry:

- **Restore this state…** moves your current branch back to that commit. The reset window opens
  with **Keep my changes** chosen: your files follow, and your uncommitted changes stay. It says
  which commits would leave the branch before anything happens.
- **Create a branch here…** gets lost commits back without moving anything: a new branch points
  at them, and you can look at them, merge them or cherry-pick from them.
- **Check out this commit…** looks at that state without changing any branch.
- **Copy commit id**.

Git forgets reflog entries after a while (90 days by default, 30 for commits no branch has), so
get lost work back soon.
