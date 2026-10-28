# The main window

From left to right, the main window has:

- a strip of icons, the **activity bar**;
- a **sidebar** with modules;
- the **toolbar** and your **tabs**.

The status bar runs along the bottom.

## Activity bar and modules

Each icon in the activity bar opens a module in the sidebar:

| Icon   | Module         | Shortcut | What it shows                                                          |
| ------ | -------------- | -------- | ---------------------------------------------------------------------- |
| Folder | Repositories   | Alt+1    | Your open repositories with their submodules, and recently opened ones |
| Branch | Branches       | Alt+2    | Local branches, the branches of each remote, and tags                  |
| Commit | Commit details | Alt+3    | Everything about the selected commit                                   |
| Box    | Stashes        | Alt+4    | Your stashes                                                           |

Clicking the icon of a module that is already showing hides the sidebar; click any icon to show
it again. You can also drag the line between the sidebar and the tabs to change its width.

Modules sit in the sidebar as tabs. Drag a module's tab to move it: next to another tab, or to
an edge to place it above or below the others.

The modules follow the **active repository**: the repository tab you used last. If you click a
commit in that repository, Commit details shows it right away.

### Repositories

Your open repositories are listed first. Below each one are its **submodules**, and below those
their own submodules. Click a repository to switch to its tab, or click a submodule to open it in
a tab of its own. A grey submodule has not been downloaded yet ("initialized"); NoBlame cannot
initialize submodules in this version.

Under **Recent** are the repositories you opened before. Hover over one and click **×** to remove
it from the list. The buttons at the top open or create a repository.

### Branches

Type in the box at the top to filter. Click a section title to fold it. Click a branch or a tag
to select its commit in the graph. The branch you are on is marked **HEAD**. You cannot switch,
create or delete branches here yet.

### Commit details

Shows the selected commit:

- its full message and commit id, with a button to copy the id;
- its parent commits (click one to select it);
- who wrote it and when, in their own time zone;
- its labels;
- under **Contained in**, every branch, remote branch and tag that includes the commit.

### Stashes

Lists your stashes, newest first, with the branch they were made on and when. The list updates
when you come back to NoBlame. You cannot create, apply or drop stashes here yet.

## Toolbar

The toolbar acts on the active repository, whose name and current branch are shown on its right.

- **Pull** (with ▾ for Fetch, Fetch all remotes and Fetch and prune), **Push** and **Commit** are
  greyed out: they arrive in later versions. Hover over them to see which.
- **Stashes** opens the Stashes module.
- The magnifier opens the [command palette](command-palette.md).

## Tabs

Every open repository has its own tab, and there is a **Welcome** tab.

- Click a tab to show it. Click the **×** on a tab to close it.
- Opening a repository that is already open switches to its tab instead of opening a second one.
- To see two tabs at once, drag one by its title to the left, right, top or bottom edge of the
  tab area.
- If you close every tab, click **Open Welcome tab** to get it back.

A repository tab shows the repository's name, branch and path at the top and its
[commit graph](commit-graph.md) below. When you close the tab, NoBlame releases the repository.
The Log, Commit and File history buttons in the tab open windows that are placeholders in this
version. See [Opening repositories](opening-repositories.md).

## NoBlame remembers your layout

When you start NoBlame again, it reopens your tabs and puts the modules and tabs back where you
left them. A repository in a tab you have not looked at yet is only opened when you switch to
that tab.

To go back to the original arrangement, open the command palette and run **Reset layout**. Your
tabs stay open.

## Welcome tab

The Welcome tab is your starting point. It has **Open repository…** and **Create repository…**
buttons, the list of **Recent repositories**, the most useful keyboard shortcuts and a tip for
starting NoBlame from a terminal. If git is missing or too old, the Welcome tab shows what is
wrong, how to fix it and a **Check again** button.

## Status bar

From left to right:

- The NoBlame version.
- The git NoBlame uses, for example **Git 2.47.1**. Hover over it to see the path and any
  advice. Click it to check again, for example after you installed git. Its icon means:
  - a check mark: git was found and is supported;
  - a yellow warning: git was found but is older than 2.39;
  - a red cross: git was not found or could not be run;
  - a spinner: NoBlame is still checking.
- **Commands**: opens the [command palette](command-palette.md).
- **Theme**: choose System (follow your operating system), Light or Dark. NoBlame remembers your
  choice.

## About NoBlame

Open it from the command palette (**About NoBlame**). It shows the NoBlame version, your
platform, and the version and full path of the git in use. This is useful in bug reports.

## Task windows

Some actions open in their own small window, for example a commit window opened from the command
line. In this version these windows are placeholders: they show the task and the path, and say
which milestone delivers them. See [Command line](command-line.md).
