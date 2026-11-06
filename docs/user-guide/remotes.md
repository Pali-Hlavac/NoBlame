# Fetching from remotes

A remote is a copy of the repository somewhere else, such as on GitHub (usually called
`origin`). **Fetching** downloads what is new there: new commits, branches and tags. It does
not change your branches or your files; your branches show how far behind they are (see
[Branches and tags](branches.md#upstreams)).

## How to fetch

- In the toolbar, open the menu next to **Pull** (▾) and choose:
  - **Fetch**: from the remote of your current branch (usually `origin`);
  - **Fetch all remotes**: from every remote;
  - **Fetch and prune**: also removes the remote branches that were deleted on the remote.
- Or press the command palette key and type "fetch".
- In the Repositories module, a repository's **…** menu has **Fetch**, even for repositories
  that are not open.

## While it runs

You can keep working. The status bar at the bottom shows what is running and how far it got.
Click it to see all recent jobs:

- **Cancel** stops the fetch completely.
- **Log** shows everything Git printed.
- **Copy command** copies the Git command, so you can run it yourself in a terminal.

When the fetch ends, a message tells you what changed, or why it failed.

## If it fails

The message shows what Git said. Common reasons:

- the remote asks for a user name and password, or an SSH key passphrase: NoBlame cannot ask
  for these yet (coming soon). If Git already remembers them (a credential manager or an SSH
  agent), fetching works;
- there is no network, or the remote's address is wrong.
