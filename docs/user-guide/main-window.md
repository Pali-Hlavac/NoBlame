# The main window

The main window has a sidebar on the left, tabs on the right and a status bar at the bottom.

## Sidebar: Repositories

The sidebar lists the repositories you have open. Click one to switch to its tab. The folder
button at the top opens a folder picker so you can open another repository.

You can drag the line between the sidebar and the tabs to make the sidebar wider or narrower.

## Tabs

Every open repository has its own tab, and there is a **Welcome** tab.

- Click a tab to show it. Click the **×** on a tab to close it.
- Opening a repository that is already open switches to its tab instead of opening a second one.
- When the tab bar has focus, the left and right arrow keys move between tabs.
- If you close every tab, click **Open Welcome tab** to get it back.

A repository tab shows the repository's name, branch and path at the top and its
[commit graph](commit-graph.md) below. When you close the tab, NoBlame releases the repository.
The Log, Commit and File history buttons in the tab open windows that are placeholders in this
version. See [Opening repositories](opening-repositories.md).

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
