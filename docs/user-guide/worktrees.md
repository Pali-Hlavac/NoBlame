# Worktrees

A worktree is a second (or third…) folder of the same repository with another branch checked
out. You can work on two branches at once, for example fix a bug while a feature is half done,
without stashing or switching. All worktrees share the history and the branches: a commit made
in one is visible in the others.

## The Worktrees module

Open **Worktrees** in the activity bar (Alt+9). It lists the worktrees of the repository you are
looking at, the main one first. Each shows its folder, what it has checked out and where it is:

- **main**: the repository's original folder;
- **this tab**: the worktree you are looking at;
- a lock: it is locked (point at it for the reason);
- **folder gone**: its folder was deleted; Git still remembers it.

Click a worktree to open it in a tab of its own.

## Adding a worktree

Click **+** (**Add a worktree…**) and choose what it checks out:

- **A new branch**: type its name; it starts at your current branch unless you change
  **Starting at**;
- **A branch**: one that no other worktree has checked out (Git allows each branch in one
  worktree at a time);
- **A commit, without a branch**.

NoBlame suggests a folder next to your repository, such as `app-fix` for the branch `fix`;
change it or click **Browse…**. The folder must be new or empty. With **Open it when done**, the
new worktree opens in a tab.

## Removing, locking and pruning

Right-click a worktree:

- **Remove…** deletes its folder. Its branch stays. If it has changes you have not committed,
  NoBlame tells you how many, and **Remove with its changes** deletes them too. You cannot
  remove the main worktree, the one you are looking at, or a locked one.
- **Lock…** keeps Git from removing or pruning it, for example while it is on a USB drive that
  is not plugged in. **Unlock** undoes it.
- **Copy path**.

When you deleted a worktree's folder yourself, **Prune** (the eraser button) makes Git forget
it. Its branch stays.
