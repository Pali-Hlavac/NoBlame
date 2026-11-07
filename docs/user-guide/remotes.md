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
  - **Fetch all remotes**: from every remote, one after the other;
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

## Adding, changing and removing remotes

Open the menu next to **Pull** (▾) and choose **Remotes…** (or click the cloud button at the top
of the Branches module, or type "remotes" in the command palette). The window lists each
remote with its address and how many of its branches you have.

- **Add remote…**: give it a name (`origin` for the main one, `upstream` for the project you
  forked from) and its address, the same you would give `git clone`. Leave **Fetch its
  branches now** ticked to download its branches straight away.
- The pencil changes a remote's name or address. **Push URL** is for when you push somewhere
  else than you fetch from; leave it empty otherwise. Renaming also renames its branches here.
- The bin removes a remote. NoBlame first says what goes: its branches in this repository, and
  which of your branches stop tracking it. Nothing changes on the server.
- The arrows fetch that remote.

## Cloning a repository

Click **Clone repository…** on the Welcome tab or at the top of the Repositories module (or
type "clone" in the command palette):

1. Paste the repository's address into **URL**.
2. **Into** is the folder that will hold it; **Folder name** is filled in from the address.
   Below them NoBlame shows the full path it will create.
3. Change the options if you like:
   - **Branch**: check out another branch than the default one;
   - **Download: File contents when needed**: a much smaller download for big repositories;
     Git fetches a file's contents when you first need them;
   - **Only the newest commits**: just the last few commits instead of the whole history;
   - **Only that branch**: leave out the other branches;
   - **Submodules too**: also clone the repositories it includes (on by default);
   - **Open it when done**.
4. Click **Clone**. It runs in the background like a fetch; **Cancel** stops it and removes the
   half-finished folder. When it is done the repository opens in a new tab.

The folder must be new or empty; NoBlame tells you before starting if it is not.

## In the Repositories module

You can pull and push repositories without opening them:

- A repository's **…** menu has **Pull** and **Push**. Pull works like the toolbar's Pull;
  Push sends the current branch to its upstream. If the branch has none yet, NoBlame says so:
  open the repository and use **Push…** once to choose where.
- A group's **…** menu has **Pull all** and **Push all**: every repository in the group at
  once. Pull all always merges. When all of them have finished, one message sums it up, for
  example "Pull all in Work: 3 done, 1 failed", with the failed ones first and what to do about
  them.
- To have buttons for these on the rows themselves, choose them in **Settings → Repositories →
  Quick buttons**. They appear when you point at a row, and show a spinning circle while the
  pull or push runs.

## While it runs

You can keep working. The status bar at the bottom shows what is running and how far it got.
Click it to see all recent jobs:

- **Cancel** stops it completely.
- **Log** shows everything Git printed.
- **Copy command** copies the Git command, so you can run it yourself in a terminal.
- **Output window** shows Git's output in a window of its own.

When it ends, a message tells you what changed, or why it failed and what to do.

### Watching Git's output

If you like to see what Git prints, as in a terminal, switch on **Settings → Fetch, pull and
push → Show git's output in a window while they run**. From then on a **Git output** window
opens at the top right whenever a fetch, pull or push starts. You can keep working while it
is open. It shows the command, everything Git prints and how far it got, and at the end
whether it worked.

- **Cancel** stops Git, **Copy output** copies everything, **×** (or Escape) closes the window;
  closing it does not stop anything.
- When you start several at once (Pull all), choose which one to watch in the list at the top.
- With **Close when they succeed** ticked, the window closes by itself when everything went
  well, and stays open when something failed.

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
