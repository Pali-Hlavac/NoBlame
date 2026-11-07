# Opening repositories

## Open a repository

Any of these opens a repository in its own tab:

- Click **Open repository…** on the Welcome tab, or the folder button at the top of the
  Repositories module, and choose the repository folder.
- Click a repository in **Recent repositories** on the Welcome tab or under **Recent** in the
  Repositories module.
- Click a submodule in the Repositories module.
- Open the [command palette](command-palette.md) and run **Open repository…**.
- From a terminal: `noblame path/to/repo` (see [Command line](command-line.md)).

You can choose any folder inside a repository; NoBlame opens the whole repository. If the
repository is already open, NoBlame switches to its tab.

## Create a repository

Click **Create repository…** on the Welcome tab (or run it from the command palette) and choose a
folder. NoBlame creates an empty Git repository there and opens it. If you open a folder that is
not a repository, the tab offers **Create a repository here** as well.

## Clone a repository

Click **Clone repository…** on the Welcome tab to copy a repository from a server (or another
folder) to your computer. See [Cloning a repository](remotes.md#cloning-a-repository).

## Recent repositories

The Welcome tab lists the last 20 repositories you opened, newest first. A repository whose folder
was moved or deleted is shown dimmed. To remove an entry, hover over it and click **×**.

## The repository tab

At the top of a repository tab you see:

- the repository name and the branch you are on (or "detached" with a commit id, or "no commits
  yet" for a new repository);
- labels such as **Bare**, **Worktree**, **Submodule** or **Shallow clone** when they apply;
- the full path;
- buttons that open Log, Commit and File history windows. These windows are placeholders in this
  version.

Below that is the [commit graph](commit-graph.md).

## Changes made outside NoBlame

NoBlame notices when you work on a repository elsewhere: commit in a terminal, switch branches,
fetch, or save a file in your editor. The history, branches, stashes and the uncommitted
changes update by themselves within a moment. Files your `.gitignore` excludes, such as build
output, are not watched.

## Opening again is faster

NoBlame remembers the history of repositories you have opened (in its cache folder), so opening
one again only reads what is new. You can delete that folder at any time; NoBlame then reads the
whole history once more.

## "History loads much faster with a commit-graph file"

Large repositories load faster when Git has written a summary of the history called a
commit-graph file. If a repository has none, NoBlame offers **Write commit-graph**. It runs
`git commit-graph write --reachable --changed-paths`, which can take a minute on very large
repositories, and you can keep working meanwhile. Click **×** to hide the notice.

The file is a speed-up that Git itself uses too: it is added to the hidden `.git` folder, it is
never pushed, and your commits, branches and files do not change. Git also writes it during its
regular clean-up (`git gc`). If loading a repository took more than a couple of seconds, the
notice is highlighted and tells you how long loading took and how long writing the file would
take. NoBlame only writes it when you click the button.

## When a repository does not open

- **"… is not a Git repository"**: the folder is not inside a repository. Choose another folder,
  or click **Create a repository here**.
- **"Git does not trust the repository …"**: the repository belongs to another user account, and
  Git refuses such repositories unless you say they are safe. If you trust it, run the command
  shown in the message in a terminal, then click **Try again**. NoBlame never changes this setting
  for you.
