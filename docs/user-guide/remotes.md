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
manager, so you are not asked again. **Cancel** stops the fetch.

## If it fails

The message shows what Git said. Common reasons:

- a wrong password or token, or the login was cancelled;
- there is no network, or the remote's address is wrong.
