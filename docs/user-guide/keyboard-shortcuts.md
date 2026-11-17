# Keyboard shortcuts

On macOS, use **⌘** where this page says **Ctrl**, except for switching tabs, which uses
**Ctrl** on every platform. These are the app's own keys; you can change them (see the end of
this page).

| Shortcut            | Action                                  |
| ------------------- | --------------------------------------- |
| Ctrl+K (⌘K)         | Open or close the command palette       |
| Ctrl+O (⌘O)         | Open a repository                       |
| Ctrl+Shift+F (⌘⇧F)  | Fetch                                   |
| Ctrl+Shift+P (⌘⇧P)  | Pull                                    |
| Ctrl+P (⌘P)         | Push                                    |
| Ctrl+Shift+N (⌘⇧N)  | Create a branch                         |
| Ctrl+Shift+S (⌘⇧S)  | Stash changes                           |
| Ctrl+W (⌘W)         | Close the current tab                   |
| Ctrl+Tab            | Next tab                                |
| Ctrl+Shift+Tab      | Previous tab                            |
| F6                  | Move to the next part of the window     |
| Shift+F6            | Move to the previous part of the window |
| Alt+1               | Show Repositories                       |
| Alt+2               | Show Branches                           |
| Alt+3               | Show Commit details                     |
| Alt+4               | Show Stashes                            |
| Alt+5               | Show Changed files                      |
| Alt+6               | Show Files                              |
| Alt+7               | Show Commit                             |
| Alt+8               | Show Reflog                             |
| Alt+9               | Show Worktrees                          |
| Alt+0               | Show Git LFS                            |
| Ctrl+Enter (⌘Enter) | Commit, in the commit message box       |
| Ctrl+, (⌘,)         | Open Settings                           |
| Ctrl+F (⌘F)         | Find commits in the active repository   |
| Ctrl+Shift+G (⌘⇧G)  | Go to a commit, branch or tag           |
| Escape              | Close the palette, a dialog or a popup  |
| Enter               | Run the selected command in the palette |

**F6** moves between the activity bar, the sidebar, the toolbar, the tabs and the status bar.

## In the commit graph and other lists

Click the list (the commits, or the branches in the Branches module) or move to it with **Tab**
first. **Enter** in the Branches list selects the branch's commit or folds a section; **F2** renames
the chosen branch and **Delete** deletes the chosen branch or tag (both ask first).

| Shortcut                        | Action                                     |
| ------------------------------- | ------------------------------------------ |
| Up / Down                       | Previous / next entry                      |
| Page Up / Page Down             | One screen up / down                       |
| Home / End                      | First / last entry                         |
| Esc (commit list)               | Clear the highlight of the selected commit |
| Shift+F10 / Menu key            | Open the selected commit's context menu    |
| Ctrl+click (Cmd+click) a commit | Compare it with the selected commit        |
| Enter / Shift+Enter (find bar)  | Next (older) / previous (newer) match      |

Tab shortcuts do nothing while a dialog is open, so they never act on a tab you cannot see.

Every button and control can be reached with **Tab** and shows a visible focus ring.

## Changing a shortcut

**Settings** (Ctrl+,) → **Keyboard shortcuts** lists every shortcut with its keys. To change
one, click its keys, then press the new ones, for example **Ctrl+Shift+F**. It works at once
and is kept with your settings.

- **Esc** stops without changing it.
- **Backspace** or **Delete** leaves it without a shortcut (shown as **None**).
- Keys need **Ctrl**, **Alt** (or **⌘** on a Mac), unless they are a function key such as
  **F3**; otherwise typing in a text field would trigger them.
- Keys another shortcut already has are refused, naming that shortcut: change that one first.
  So are the keys for copy, cut, paste, select all, undo and redo, and Alt+F4.
- The arrow beside a changed shortcut puts its own keys back; **Reset all shortcuts** at the
  bottom puts back every one.

The command palette and the button tooltips always show the keys you chose.
