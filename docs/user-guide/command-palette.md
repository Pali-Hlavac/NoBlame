# Command palette

The command palette lets you run any command by typing part of its name.

- Open it with **Ctrl+K** (Windows, Linux) or **⌘K** (macOS), the search button at the right of
  the tab bar, or **Commands** in the status bar.
- Type to filter, use the arrow keys to choose, and press **Enter** to run.
- Press **Escape** to close it without running anything.

## Available commands

| Group      | Command                      | What it does                                                                             |
| ---------- | ---------------------------- | ---------------------------------------------------------------------------------------- |
| Repository | Open repository…             | Choose a folder and open it in a new tab                                                 |
| Repository | Create repository…           | Choose a folder and create a new repository there                                        |
| Branches   | Create a branch…             | A new branch at the commit selected in the graph (or at the commit you have checked out) |
| Tabs       | Open Welcome tab             | Shows the Welcome tab (opens it again if closed)                                         |
| Tabs       | Close current tab            | Closes the tab you are looking at (Ctrl/⌘+W)                                             |
| Appearance | Theme: System / Light / Dark | Changes the color theme; NoBlame remembers it                                            |
| Help       | Check git installation again | Looks for git again, for example after installing                                        |
| Help       | About NoBlame                | Shows versions and the git in use                                                        |

## Task window commands

When a repository tab is active, the palette also lists one command per task window, for
example **Open Commit window** or **Open File history window**. They open a separate window for
that repository, just like `noblame commit <path>` on the [command line](command-line.md).

In this version these windows are placeholders. The palette group says so: "Task windows
(placeholders until M8)".
