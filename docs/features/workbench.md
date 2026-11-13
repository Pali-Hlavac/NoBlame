# Workbench

The main window's layout: activity bar, module dock, document dock and toolbar. Design and the
owner's decisions: [design/workbench.md](../design/workbench.md). Docking library:
[ADR 0020](../adr/0020-workbench-docking.md). User guide:
[main-window.md](../user-guide/main-window.md).

Status: **M2.5 done.** Changed files and the diff tab are M3 ([changed-files.md](changed-files.md), [diff.md](diff.md)). Actions in Branches,
Stashes and the toolbar arrive in M4 and M5.

## Layout

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ 🐦 Pull ▾  Push  Commit  Stashes   (drag area)      app  main  🔍   _  □  ×  │
├────┬───────────────────┬─────────────────────────────────────────────────────┤
│ ▣  │ Repositories│Bra… │ Welcome │ synthetic-10k │ app        (document dock) │
│ ⑂  │ ─ module dock ─── │                                                     │
│ ◇  │ Commit det…│Stash │                                                     │
├────┴───────────────────┴─────────────────────────────────────────────────────┤
│ status bar                                                                   │
└──────────────────────────────────────────────────────────────────────────────┘
```

- **Activity bar**: one icon per module. A click opens the module in the module dock, or brings
  it to the front of its group. A click on a module that is already showing hides the sidebar,
  as in VS Code.
- **Module dock** (sidebar): modules as tabs in groups. Groups can be split, resized and
  rearranged by dragging tabs. The sidebar can be resized (180 px up to 60 % of the window) and
  collapsed by dragging it closed or with the activity bar. It keeps its width in pixels when the
  window is resized; the document dock takes the difference (`groupResizeBehavior:
"preserve-pixel-size"`, owner request 2026-10-30).
- **Popped-out modules**: a module's tab menu (right-click) has **Pop out**; the module then
  opens in a popup over the window instead of the dock (see below).
- **Stacks** and the activity bar's arrangement: see below (owner request 2026-11-13).
- **Document dock**: Welcome and repository tabs. Drag a tab to an edge to split the dock left,
  right, above or below. New tabs open in the focused group.
- **Title bar** (custom, `features/window-frame`):
  - It holds the toolbar's actions for the active repository, a drag area, the active repository
    with its current branch, the command palette button and the window buttons.
  - Labels hide when the window is narrower than 48rem.
  - Because the toolbar lives here, the module tabs and the document tabs start on the same line.
  - **Windows and Linux**:
    - The main window has no system frame (`decorations(false)`); the UI draws minimize,
      maximize/restore and close.
    - Empty title-bar space drags the window, a double click maximizes, and the edges still
      resize.
    - Windows 11 snap layouts on hovering the maximize button are not available with a custom
      frame. Dragging to a screen edge still snaps.
  - **macOS**:
    - The native traffic lights stay, over a transparent title bar (`TitleBarStyle::Overlay`,
      hidden title, lights centred at 14,12).
    - The bar leaves room for them on the left and draws no window buttons.
  - Task windows keep the normal system frame.

Dragging tabs needs HTML drag and drop, so both window kinds are built with
`disable_drag_drop_handler()`. Tauri's file-drop handler would otherwise swallow the events on
Windows. Dropping folders onto the window to open them will use HTML drop events later.

Floating groups and popping a group out into its own window are switched off for now (backlog).

## Popping a module out

Owner request 2026-11-04. Right-click a module's tab in the dock (`ModuleTab`, dockview's default
tab inside a Radix context menu) → **Pop out** or **Close**.

- **Pop out** closes the module's dock panel and marks it popped out (`poppedOut` in the
  workbench store, saved as `popouts` in the layout). From then on everything that opens the
  module (activity bar, Alt+N, toolbar, palette, `openModuleById`) shows its popup instead.
- **The popup** (`ModulePopups`): over the window, inside the app, 85 % of the window high;
  narrow, or wide for modules registered with `popupWide` (Commit). While it is open the main
  window's frame is `inert`, so nothing behind it can be clicked or focused, and the popup has
  `role="dialog"`, so global shortcuts pause. Esc (unless a menu or dialog inside took it), ×
  or **Dock** close it; focus returns to where it was.
- **State is kept**: a popup is rendered once first shown and then only hidden, so the module
  keeps what was typed, filtered or scrolled until it is shown again. It unmounts when docked.
- **Dock** (in the popup's header) clears the mark and opens the module in the focused dock
  group.
- Modules ask `useModuleHost()` whether they are docked or in a popup, and can close it; only
  Commit uses it (diff beside the lists, closing after a commit).
- **Reset layout** docks every module again.

## Stacking modules

Owner request 2026-11-13: modules shown together in one dock tab, one above the other.

- **The model** (`lib/stacks.ts`): a stack is its module ids, top to bottom, with each module's
  share of the height (`sizes`, percent; `null` for equal shares). A module is in at most one
  stack. The stacks live in the workbench store and are saved with the layout (`stacks`).
- **In the dock** a stack is one panel whose id names its modules (`stack:commit-details+changed-files`),
  titled "Commit details + Changed files". `ModuleStackView` shows the modules in a vertical
  react-resizable-panels group, each under a small header (icon, title), with splitters; the
  sizes are read once when it mounts and saved when a drag ends.
- **Keeping the dock in step** (`syncStacks` in `lib/stackDock.ts`, run after every stack change
  and when the dock is restored): a module open on its own that is now stacked moves into its
  stack's panel; the panel of a stack that changed or ended gives way to its modules' panels,
  in the same group. So making, changing and ending a stack is a store change plus this pass.
- **Opening** (activity bar, Alt+N, toolbar, palette, `openModuleById`): a stacked module opens
  its stack's panel. The activity bar and `toggleModule` see every module of the stack in front
  as visible.
- **Menus** (`StackMenuItems`, in the module tab's menu and the activity bar's): **Stack with** /
  **Add to this stack** (modules that are not stacked or popped out; the new module goes at the
  bottom), **Take out of the stack** (a stack left with one module ends), **Unstack**. A stack's
  tab has no **Pop out**; a popped-out module offers no stacking.
- **Reset layout** ends every stack.

## Arranging the activity bar

Owner request 2026-11-13 (`lib/activityBar.ts`, `lib/barActions.ts`, `hooks/useBarDrag.ts`):

- **Units**: each module is an icon; a stack's icons form one unit, framed (`role="group"`, named
  after its modules), at the place of its first module, with one "showing" bar for the frame.
- **Order** (`activityBar.order`, saved with the layout): module ids; modules missing from it
  (new ones) follow in the registry's order. Dragging a unit onto another (HTML drag and drop,
  `application/x-noblame-module-icon`) drops it before (upper half) or after (lower half);
  **Move up** / **Move down** in its menu do the same with the keyboard. Making a stack gathers
  its modules where the first one is.
- **Hidden** (`activityBar.hidden`): units whose first module is listed sit under the **…**
  button above the footer (`ActivityBarOverflow`): its items open the module; **Show in the
  activity bar** brings one or all back. Hidden modules keep their shortcuts and palette entries.
- **Locked** (`activityBar.locked`): no dragging, moving, hiding or showing; **Reset the order**
  is disabled too. **Reset layout** keeps the lock and clears the order and hidden icons.
- The bar's right-click menu (`ActivityBarMenu`) is for the icon under the pointer (set by its
  `contextmenu` event, cleared first in the capture phase), or for the bar itself on empty
  space: the stack entries, **Move up**, **Move down**, **Hide (under …)**, **Lock the icons**,
  **Show all icons**, **Reset the order**.
- Task windows start with no stacks and the default order, and keep changes only while open.

## Settings button

The gear at the bottom of the activity bar opens the **Settings** tab (also **Ctrl+,** / **⌘,**
and "Open settings" in the palette). The Workbench takes the button as `activityBarFooter`, so it
knows nothing about settings; the app shell passes `SettingsButton`. The Settings tab is a
document tab like any other (`kind: "settings"`, at most one), restored with the layout.

Settings shown there (stored in `settings.json`, see `src-tauri/src/settings/types.rs`):

| Section              | Setting                                                                 | Default |
| -------------------- | ----------------------------------------------------------------------- | ------- |
| Appearance           | Theme (System, Light, Dark)                                             | System  |
| Commit graph         | Highlight the selected commit                                           | on      |
| Commit graph         | Show uncommitted changes as (rows, header summary, not shown)           | rows    |
| Commit graph         | Show the rest of the message (greyed, after the subject)                | off     |
| Commit               | Files in the lists: name then folder, or folder then name by path       | name    |
| Repositories         | Show the actions button (…) on repositories                             | on      |
| Repositories         | Show the number of uncommitted files beside repositories                | off     |
| Repositories         | Quick buttons: Pull, Push on repositories; Pull all, Push all on groups | none    |
| Fetch, pull and push | Show git's output in a window while they run                            | off     |
| Fetch, pull and push | Close the window when they succeed                                      | on      |

**Keyboard shortcuts** lists every shortcut by where it works (General, Tabs, History, Commit,
Modules), and each can be changed (M7 slice 8):

- **One registry**, `src/shared/lib/keybindings.ts`: each shortcut's id, label, group and the
  app's keys (`KEYBINDINGS`; a test checks that ids and keys are unique). Components read the
  current keys with `useKeys(id)` / `useKeymap()` (`shared/hooks/useKeys.ts`, re-rendering when
  they change); key handlers outside React call `keysOf(id)` on each key press. Modules name
  their shortcut by id (`keybinding: "module.lfs"`).
- **Saved in the settings** as the changed ones only: `keybindings: [{ id, keys }]` (empty keys:
  no shortcut). `KeybindingsController` (settings feature, mounted next to the theme) hands
  them to the registry; the settings stay their only record. Ids the app does not know are kept
  in the file but unused.
- **Recording**: clicking a shortcut's keys records the next combo (`comboOfEvent`: Ctrl, Cmd
  on macOS, is written `mod`). The keys pressed there never reach the app's own shortcuts; Esc
  cancels, Backspace or Delete leaves it without a shortcut, Tab moves on.
- **Checked** (`settings/lib/shortcuts.ts`): a key needs Ctrl, Alt or Cmd unless it is a
  function key (otherwise typing would trigger it); copy, cut, paste, select all, undo, redo,
  Alt+F4 and Cmd+Q are refused; keys another shortcut already has are refused naming it,
  compared as this platform reads them (`mod+tab` is `ctrl+tab` off macOS). A refused combo
  says why and recording goes on.
- **Reset**: one shortcut back to the app's keys (the arrow beside it, refused if another took
  them meanwhile), or **Reset all shortcuts**.

Keys typed inside lists (arrows, Enter, Delete, F2) stay with their component; the browser
shortcuts the app turns off are in `native-feel.ts`.

## Active repository and selection

- The **active repository** is the repository tab focused most recently. It stays active while
  another kind of tab (Welcome, later the diff) has focus. It moves to another repository tab when
  its own tab closes. The toolbar and every repository module follow it.
- The **selected commit** is kept per repository (`features/selection`). The graph writes it:
  HEAD on first open, then clicks and arrow keys. Modules read it.
- Modules can select commits too: a parent link in Commit details, or a branch in Branches. The
  graph then scrolls the commit into view.

## Modules

| Module         | Shortcut | Shows                                                                                                                                                                                                                                      |
| -------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Repositories   | Alt+1    | Open repositories with their submodules nested recursively, then recent repositories; open and create buttons                                                                                                                              |
| Branches       | Alt+2    | Local branches, one section per remote, tags; filter; collapsible sections; current branch marked **HEAD**; a click selects the branch's commit                                                                                            |
| Commit details | Alt+3    | Message, commit id (copy), parents (click to select), author and committer with their time zones, refs, and the branches and tags containing the commit                                                                                    |
| Changed files  | Alt+5    | The files the selected commit changed (status, renames); a merge can be compared with any parent ([changed-files.md](changed-files.md))                                                                                                    |
| Stashes        | Alt+4    | Stash list (`stash@{n}`, message, branch, date); refreshed when the window regains focus                                                                                                                                                   |
| Files          | Alt+6    | The folders and files of the selected commit, read as they are opened; showing a file opens the file tab ([files.md](files.md)); File history opens the history tab ([history.md](history.md)), Blame the blame tab ([blame.md](blame.md)) |
| Commit         | Alt+7    | Changes and staged files, stage and unstage, the message, Amend, Sign off, Commit ([commit.md](commit.md)); not in the default layout, the Commit button opens it                                                                          |
| Reflog         | Alt+8    | Where HEAD or a branch pointed before each change; select its commit, restore that state, create a branch there ([reflog.md](reflog.md))                                                                                                   |
| Worktrees      | Alt+9    | The repository's worktrees; open one as a tab, add, lock, remove, prune ([worktrees.md](worktrees.md))                                                                                                                                     |

Default arrangement: Repositories, Branches and Worktrees as tabs on top, Commit details, Changed files and
Stashes as tabs below (Files after Changed files, Reflog last). A layout saved before Changed files or Files
existed does not show them; open them from the activity bar or with Alt+5, Alt+6, Alt+8 and Alt+9.

Details:

- **Repositories**:
  - A click on a repository focuses its tab; a click on a submodule opens it as a repository
    tab.
  - An open submodule stays inside its parent's tree: shown in bold, and highlighted when it is
    the active repository. It is not listed again as a repository of its own.
  - Submodules that are not initialized are dimmed and cannot be opened; right-click one to
    initialize it. One checked out at another commit than recorded says "new commits"
    ([submodules.md](submodules.md)).
  - Each open repository (and each open submodule) has a **…** button, shown on hover or focus,
    with its actions: **Copy path**, **Close**, **Fetch** ([remotes.md](remotes.md)) and
    **Commit…** work; **Pull** and **Push** (M5 slice 6) are listed disabled with their milestone. The app shell supplies the
    actions (`src/app/workbench/repositoryActions.ts`) through `RepositoryActionsContext`, so
    the Repositories module does not depend on the features that implement them. Settings can
    hide the button.
  - Recent repositories that are already open are not repeated; missing folders are dimmed.
- **Branches**:
  - The list is virtualized, so 10,000 refs (the 1M synthetic repository) scroll smoothly.
  - Refs whose target is not a commit in the graph (a tag of a tree) are dimmed.
  - Sorting: by name, or by last commit (committer date, newest first; refs without a commit
    last), with the button beside the filter or in Settings → Branches (`branches.sort`). By
    last commit, each row shows its commit's day. The times come with `list_refs` from the
    whole history's commit index, so a filter does not hide them.
  - A right click (Shift+F10, Menu key) on a row opens its actions: check out, create a branch
    or tag there, rename, delete, copy the name; **F2** renames and **Delete** deletes the
    active row ([branches.md](branches.md)). Local branches show ↑ commits to push and ↓ to
    pull against their upstream (counted for the rows on screen), or _gone_.
- **Commit details**:
  - "Contained in" comes from the graph, not from `git branch --contains`. It is exact for every
    ref the graph knows (branches, remote branches, tags) and takes 5.5 ms for the oldest of a
    million commits.
  - At most 500 refs are listed, followed by "and N more".
  - Children come from the graph (one pass over the rows above the commit, like "contained in":
    5.6 ms for the oldest of the Linux kernel's 1.5M commits), in the full history even when a
    filter is on; a child the filter hides is shown greyed, not as a link.
  - Signatures: `get_commit_details` says what a commit is signed with (`gpgsig` header via gix:
    PGP, SSH, X.509), so unsigned commits cost nothing. For a signed one the module calls
    `verify_commit_signature` once the selection has rested for 300 ms
    (`SIGNATURE_CHECK_DELAY_MS`, so arrow-key browsing runs no gpg) and again when the window
    regains focus. It runs `git log -1 --no-show-signature --format=%G?…`, about 75 ms with
    gpg on git.git. Git reports an SSH signature as unsigned (`N`) when
    `gpg.ssh.allowedSignersFile` is not set; NoBlame shows it as "could not be checked" with
    git's message.
- **Stashes**: stash changes (chosen files, message, keep index, new files), show a stash in
  the Stash tab, apply, pop or drop it, apply chosen files ([stashes.md](stashes.md)).

Modules that work on the active repository share one frame (`WithActiveRepository`). It explains
"No repository open", "Opening repository…" or the error, so modules only render their content.

## Toolbar (in the title bar)

| Button  | Does                                                                                                                      |
| ------- | ------------------------------------------------------------------------------------------------------------------------- |
| Pull ▾  | Pull; menu: Pull (merge, rebase, fast-forward only), Fetch, Fetch all remotes, Fetch and prune ([remotes.md](remotes.md)) |
| Push ▾  | Push the current branch (to its upstream, else the dialog); menu: Push…                                                   |
| Commit  | Opens the Commit module, docked or popped out ([commit.md](commit.md))                                                    |
| Stashes | Opens the Stashes module                                                                                                  |

Placeholder buttons look dimmed but stay focusable, so their tooltip ("…: arrives in M6") can
also be read with the keyboard. Pull and Push are disabled while no branch is checked out.

## Layout persistence

- One layout for all repositories: both docks, the open tabs, the sidebar width and state, the
  popped-out modules (`popouts`; a layout without it has none), the stacks (`stacks`) and the
  activity bar's order, hidden icons and lock (`activityBar`); layouts saved before these have
  none and the default bar.
  It is saved 0.5 s after the last change into `workbench-layout.json` in the app config folder,
  and restored on the next start.
- Restored tabs in the background do not open their repositories until they are first shown.
- **Reset layout** (command palette) forgets the saved layout and rebuilds both docks with the
  default arrangement; popped-out modules are docked again, stacks end, the activity bar gets
  its default order with every icon shown (a lock stays). Open tabs stay open.
- A saved layout from another version, or one that cannot be read, is ignored and the default
  is used. Modules that no longer exist are dropped from a restored layout.

## Starting and loading

- **Start screen** (`index.html`): the bird and "Starting…" are inline SVG and HTML inside
  `#root`, styled by the `<style>` in the page head, so they show as soon as the page is parsed,
  before any app code has loaded (that takes seconds in dev, where Vite serves every module
  separately). Nothing is fetched for them. A plugin in `vite.config.ts` writes the markup from
  `shared/lib/loadingBird.ts`. React replaces it with the startup curtain, which looks the
  same. `public/theme-boot.js` (a classic script: the CSP allows no inline ones) applies the
  theme saved in local storage by `ThemeController` (`noblame.theme`; "system" or nothing
  follows the OS).
- **Window background**: windows are built hidden, get the saved theme's background colour
  (`--background`, the OS theme for "System"), then are shown. So the webview never shows white
  before the page paints.
- **Startup curtain** (`app/layout/StartupCurtain.tsx`): opaque while the settings and the
  window's purpose load, then translucent over the rendered window, blurred (`backdrop-blur-xl`).
  It lifts once no query or mutation has run for 200 ms, or 5 s after the first render at the
  latest (a huge repository's history has its own loading state): the blur goes to 0 and the
  curtain fades out over 0.5 s. Clicks do not reach the window under it.
- **Loading bird** (`shared/components/BirdLoader.tsx`): a songbird chirping on a berry branch
  (the owner's `assets/chirping birb/Chirping-Songbird-on-Berry-Branch.svg`), drawn inline in
  the text colour (black on light, white on dark), two notes rising from its open beak. Still
  with reduced motion. `LoadingState` (every module's loading message) and `LoadingOverlay`
  (stale content kept under a blur, as in the diff tab) use it.
  - **To replace it**: put the new single-colour picture's path, transform and a viewBox
    around it into `BIRD` in `shared/lib/loadingBird.ts`, with where its beak is and how big
    the notes should be. The app and the start screen both follow.

## Keyboard

- `F6` / `Shift+F6` move focus to the next or previous region: activity bar, modules, toolbar,
  tabs, status bar. A collapsed sidebar is skipped.
- `Alt+1` … `Alt+9` and `Alt+0` open a module (keys changeable in Settings, see above).
- Each module is also in the command palette under **View** ("Show Branches", ...), next to
  **Reset layout**.
- The commit list, the Branches list and other long lists are listboxes. Arrows, Page Up/Down
  and Home/End move; Enter activates.

## Colours by kind of work

Modules, toolbar buttons, repository actions, menus, palette commands and the rows of the
Repositories module carry a `kind` (`WorkKind` in `src/shared/lib/workKinds.ts`) that colours
their icon. One colour means one thing everywhere (owner, 2026-11-03):

| Kind           | Colour | Used by                                                                                   |
| -------------- | ------ | ----------------------------------------------------------------------------------------- |
| `commit`       | green  | Commit details, Changed files, Commit (toolbar, "…" menu)                                 |
| `stash`        | amber  | Stashes (module, toolbar)                                                                 |
| `history`      | teal   | Files, Find, Go to commit, Compare                                                        |
| `branches`     | violet | Branches, Pull (and its menu), Fetch, Push, Pull all, Push all                            |
| `repositories` | blue   | Repositories, repository rows, Open and Create repository (buttons, palette, menus)       |
| `groups`       | orange | Group folders, New group, Add to / Move to / Remove from group                            |
| `submodules`   | violet | Submodule rows and submodule entries in Changed files and Files (own token, same hue now) |

Without a kind (Settings, About, Copy path, Rename) an icon keeps the text colour; icons on
filled (primary) buttons keep the button's text colour.

**Menu icons** (owner request 2026-11-13): the commit graph's context menu and the Branches
module's show an icon before most entries, one per action wherever it appears
(`src/shared/lib/actionIcons.ts`, by entry id; `MenuIcon` draws it). It takes the colour of the
kind of work the action does: branch actions (check out, create a branch or tag, merge, rebase,
push, upstream) violet, compare, browse, highlight and bisect teal, cherry-pick, revert and
patches green; Delete is red (`text-destructive`); Copy and Rename keep the text colour. The
references on a commit are submenus with a branch icon (branches), a globe (remote branches) or
a tag. Entries without an icon keep its room when others in the same menu have one, so the
labels line up. The colours are the `--kind-*` tokens in
`src/app/styles.css` (light and dark); recolouring a kind is a change there only.

## Adding a module

1. Create `src/features/<module>/` with the component, and export it from its `index.ts`.
2. Add one entry to `MODULES` in `src/app/workbench/modules.ts`: `id` (never reuse one, layouts
   store it), title, icon, `kind` (its colour), hotkey and component. Optionally add it to `DEFAULT_MODULE_LAYOUT`.
3. Read the active repository with `WithActiveRepository` / `useActiveRepository`
   (`features/repositories`), and the selection with `useSelectedRow` (`features/selection`).

Nothing in the docks or the activity bar changes.

## Not yet

- Several diff tabs, or a diff in its own window.
- Actions in Branches and Stashes and in the toolbar (M4, M5).
- Ahead/behind counts next to the branch.
- Dragging modules into the document dock.
- Popping panels out into windows.
