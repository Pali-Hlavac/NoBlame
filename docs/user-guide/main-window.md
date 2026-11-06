# The main window

At the top is the **title bar** with the toolbar. Below it, from left to right:

- a strip of icons, the **activity bar**;
- a **sidebar** with modules;
- your **tabs**.

The status bar runs along the bottom.

While NoBlame starts, a small singing bird shows right away, in your theme's colours. Once the
window is ready, it shows blurred behind the bird. You can already move the window by
dragging anywhere on it.
When everything has loaded (at most five seconds), the blur clears and the bird fades away. The
same bird shows wherever something is still loading.

Drag the empty part of the title bar to move the window, and double-click it to maximize. On
Windows and Linux the minimize, maximize and close buttons are at its right end. On macOS the
usual coloured buttons are at its left end.

## Activity bar and modules

Each icon in the activity bar opens a module in the sidebar:

| Icon   | Module         | Shortcut | What it shows                                                          |
| ------ | -------------- | -------- | ---------------------------------------------------------------------- |
| Folder | Repositories   | Alt+1    | Your open repositories with their submodules, and recently opened ones |
| Branch | Branches       | Alt+2    | Local branches, the branches of each remote, and tags                  |
| Commit | Commit details | Alt+3    | Everything about the selected commit                                   |
| Box    | Stashes        | Alt+4    | Your stashes                                                           |
| File   | Changed files  | Alt+5    | The files the selected commit changed; choose one to see its diff      |
| Tree   | Files          | Alt+6    | Every folder and file of the selected commit; choose one to see it     |
| Commit | Commit         | Alt+7    | Stage your changes and commit them ([Committing](committing.md))       |

The icons are coloured by what they are about, the same everywhere in the app: green for
commits and committing (Commit details, Changed files, Commit), amber for stashes, teal for
browsing history (Files, Find, Compare), violet for branches and remotes (Branches, Pull, Push),
blue for repositories (also the open and create buttons), orange for groups, and purple for
submodules. Settings and About keep the normal colour.

The gear at the bottom of the activity bar opens **Settings** in a tab: the theme, the commit
highlight, whether repositories show their **…** button, and how diffs look.

Clicking the icon of a module that is already showing hides the sidebar; click any icon to show
it again. You can also drag the line between the sidebar and the tabs to change its width.

Modules sit in the sidebar as tabs. Drag a module's tab to move it: next to another tab, or to
an edge to place it above or below the others.

### Popping a module out

Right-click a module's tab in the sidebar and choose **Pop out**. The module leaves the sidebar
and opens in a popup over the window, and from then on it always opens there: from its icon,
its shortcut or the toolbar. While the popup is open the rest of NoBlame waits; close it with
**×** or Esc to carry on.

Closing the popup keeps what you did in it. A half-written commit message, a filter you typed
or the file you chose are still there when you open it again. To put the module back in the
sidebar, click **Dock** in the popup's header. **Reset layout** docks every module again.

The modules follow the **active repository**: the repository tab you used last. If you click a
commit in that repository, Commit details shows it right away.

### Repositories

Your open repositories are listed first. Below each one are its **submodules**, and below those
their own submodules. Click a repository to switch to its tab, or click a submodule to open it in
a tab of its own. An open submodule is shown in bold and stays in its place in the tree.
Groups have orange folders, repositories blue icons and submodules purple ones.
Point at a repository (open, in a group, or a downloaded submodule) to see its **…** button:
**Copy path** works, **Open** opens it if it is not open yet, **Close** closes its tab, and in a
group **Remove from group** takes it out. **Commit…** shows the repository and opens the commit
window. **Pull**, **Fetch** and **Push** work even when the repository is not open
([Fetching, pulling and pushing](remotes.md#in-the-repositories-module)). A grey submodule has not been downloaded yet ("initialized"); NoBlame cannot
initialize submodules in this version.

Click the title of a section (**Open**, **Groups**, **Recent**) to fold or unfold it. Drag a
title onto another section to change their order, or press Alt+Up or Alt+Down on it. NoBlame
remembers both.

Under **Groups** you can sort repositories into folders of your own, like bookmarks:

- Click the **New group** button at the top, type a name and press Enter.
- Drag any repository onto a group to add it, or right-click it and choose **Add to group**.
  Its submodules show below it in the group, as under Open.
- Drag repositories within a group, or groups among themselves, to change their order.
- Click a group to fold or unfold it. Press F2 or use its **…** menu to rename it.
- The **…** menu also opens every repository of the group at once, pulls or pushes them all
  (**Pull all**, **Push all**), or deletes the group (your repositories stay where they are).

Under **Recent** are the repositories you opened before. Hover over one and click **×** to remove
it from the list. The buttons at the top open or create a repository.

To see which repositories have work that is not committed yet, switch on **Settings →
Repositories → Show the number of uncommitted files beside repositories**. Each repository then
shows, at the right, how many files are new (**+**, green), changed (**~**, yellow) and deleted
(**−**, red); point at the numbers to read them in words. A repository without changes shows
nothing. Repositories that are not open are checked again whenever you come back to NoBlame;
on very large ones that takes a moment.

### Branches

Type in the box at the top to filter. Click a section title to fold it. Click a branch or a tag
to select its commit in the graph. The branch you are on is marked **HEAD**. The button next
to the filter sorts by name or by last commit (newest first, with the date of each); NoBlame
remembers your choice, also in **Settings → Branches**. You cannot switch,
create or delete branches here yet.

### Commit details

Shows the selected commit:

- its full message and commit id, with a button to copy the id;
- its parent commits and its children, the commits made on top of it (click one to select it);
- who wrote it and when, in their own time zone;
- for a signed commit, whether the signature is good, who signed it and with which key. NoBlame
  asks Git, which uses your own GPG keyring or, for SSH signatures, the file named in Git's
  `gpg.ssh.allowedSignersFile` setting. "Could not be checked" usually means the signer's public
  key is missing, or that no allowed signers file is set up. Open **Verification output** to
  see the exact message. After importing a key, switch back to NoBlame to check again;
- its labels;
- under **Contained in**, every branch, remote branch and tag that includes the commit.

### Stashes

Lists your stashes, newest first, with the branch they were made on and when. **Stash
changes…** stashes your changes; click a stash to see its files, and use its **…** menu to apply,
pop or drop it. See [Stashing](stashing.md).

## Toolbar

The toolbar sits in the title bar and acts on the active repository. That repository's name and
current branch are shown on the right of the title bar.

- **Pull** brings in what is new on your branch's remote; its ▾ menu pulls by merging, by
  rebasing or only when it is a fast-forward, and fetches. **Push** sends your branch; its ▾
  menu opens **Push…** with more choices ([Fetching, pulling and pushing](remotes.md)). While
  something runs, the status bar shows its progress; click it to see the jobs.
- **Commit** opens the Commit module, in the sidebar or in its popup if you popped it out
  ([Committing](committing.md)).
- **Stashes** opens the Stashes module.
- The magnifier opens the [command palette](command-palette.md).

## Tabs

Every open repository has its own tab, and there is a **Welcome** tab. Choosing a file in
Changed files opens the **Diff** tab, which shows that file's changes
([Viewing changes](viewing-changes.md)). Choosing a file in Files opens the **File** tab, which
shows the whole file at that commit ([Browsing files](browsing-files.md)). The two open next to
each other, beside the commit graph. **History** ([File history](file-history.md)) and **Blame**
([Blame](blame.md)) open beside the repository tab, so the Diff tab stays visible next to them.
**Compare** ([Comparing](compare.md)) opens with the Diff and File tabs, beside the graph.

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
left them, popped-out modules included. A repository in a tab you have not looked at yet is only opened when you switch to
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
