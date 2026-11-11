# Scripts

A script is a Git command you use often, saved with a name, that you run on a commit from its
menu. For example, a script named **Show stats** with `log --stat -1 {sha}` shows which files
the commit changed.

## Adding a script

Open **Settings** (the gear at the bottom of the activity bar) → **Scripts**. Type a name and
Git's arguments (what you would type after `git` in a terminal), then click **Add the script**.
Words in quotes stay together: `tag -m "Released {subject}" release-{short} {sha}`.

Placeholders are filled in for the commit you run the script on:

- `{sha}`: the commit's id; `{short}`: its first 8 characters;
- `{subject}`: its subject line;
- `{branch}`: the branch you have checked out;
- `{repo}`: the repository's folder.

To remove a script, click the bin next to it.

## Running a script

Right-click a commit in the graph → **More** → **Run a script** → the script's name. It runs in
the background: a notification follows it, and its output is in the jobs list (status bar) and
the Git output window. You can cancel it there.

A script runs Git only, exactly with the arguments you wrote; it can change your repository like
any Git command, so write ones you trust.
