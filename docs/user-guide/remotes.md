# Fetching, pulling and pushing

A remote is a copy of the repository somewhere else, such as on GitHub (usually called
`origin`).

- **Fetching** downloads what is new there: new commits, branches and tags. It does not change
  your branches or your files; your branches show how far behind they are (see
  [Branches and tags](branches.md#upstreams)).
- **Pulling** fetches and then brings the new commits into your current branch.
- **Pushing** sends your commits to the remote.

## How to fetch

- In the toolbar, open the menu next to **Pull** (▾) and choose:
  - **Fetch**: from the remote of your current branch (usually `origin`);
  - **Fetch all remotes**: from every remote;
  - **Fetch and prune**: also removes the remote branches that were deleted on the remote.
- Or press the command palette key and type "fetch".
- In the Repositories module, a repository's **…** menu has **Fetch**, even for repositories
  that are not open.

## Pulling

**Pull** (in the toolbar) fetches and then brings the new commits into your current branch.
If you and others both made commits, Git joins them the way your settings say. The menu next
to Pull lets you choose for once:

- **Pull (merge)**: adds a merge commit that joins both;
- **Pull (rebase)**: puts your new commits on top of theirs;
- **Pull (fast-forward only)**: only when you have no commits of your own; otherwise it stops.

If Git cannot pull (for example because of uncommitted changes, or conflicting changes in the
same lines), the message says why and what to do next.

## Pushing

**Push** sends the commits of your current branch to its remote. If the branch has never been
pushed, NoBlame asks where to: the remote, the name there, and whether to remember it as the
branch's upstream (so the next Push goes there directly).

**Push…** (in Push's menu, or on any branch in the Branches list) shows these choices every
time, and also:

- **Also push annotated tags on these commits**;
- **Force: replace the branch there**: for when you rewrote commits you had already pushed.
  NoBlame first lists the commits on the remote that would disappear from the branch. If
  someone pushed something new since your last fetch, nothing is replaced, so you cannot
  remove their work by accident.

On a tag, **Push…** sends the tag. **Delete on the remote…** (on a remote branch such as
`origin/feature`) or **Delete on a remote…** (on a tag) removes it on the remote for everyone,
after asking.

## While it runs

You can keep working. The status bar at the bottom shows what is running and how far it got.
Click it to see all recent jobs:

- **Cancel** stops it completely.
- **Log** shows everything Git printed.
- **Copy command** copies the Git command, so you can run it yourself in a terminal.

When it ends, a message tells you what changed, or why it failed and what to do.

## Passwords and keys

If Git already remembers your login (for example with Git Credential Manager, the keychain or
an SSH agent), nothing changes: fetching just works.

Otherwise NoBlame asks, in a small window:

- your **user name** and **password** (for GitHub and similar sites, a personal access token
  is the password);
- the **passphrase** of your SSH key;
- whether to **trust a server** NoBlame has not connected to before. Compare the fingerprint
  with the one the server's owner publishes, then choose **Trust and connect**.

NoBlame passes what you type to Git and does not keep it. Git may save it with your credential
manager, so you are not asked again. **Cancel** stops what was running.

## If it fails

The message shows what Git said. Common reasons:

- a wrong password or token, or the login was cancelled;
- there is no network, or the remote's address is wrong.
