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

## Settings button

The gear at the bottom of the activity bar opens the **Settings** tab (also **Ctrl+,** / **⌘,**
and "Open settings" in the palette). The Workbench takes the button as `activityBarFooter`, so it
knows nothing about settings; the app shell passes `SettingsButton`. The Settings tab is a
document tab like any other (`kind: "settings"`, at most one), restored with the layout.

Settings shown there (stored in `settings.json`, see `src-tauri/src/settings/types.rs`):

| Section      | Setting                                                       | Default |
| ------------ | ------------------------------------------------------------- | ------- |
| Appearance   | Theme (System, Light, Dark)                                   | System  |
| Commit graph | Highlight the selected commit                                 | on      |
| Commit graph | Show uncommitted changes as (rows, header summary, not shown) | rows    |
| Repositories | Show the actions button (…) on repositories                   | on      |

**Keyboard shortcuts** are listed as arriving in M7 (configurable shortcuts).

## Active repository and selection

- The **active repository** is the repository tab focused most recently. It stays active while
  another kind of tab (Welcome, later the diff) has focus. It moves to another repository tab when
  its own tab closes. The toolbar and every repository module follow it.
- The **selected commit** is kept per repository (`features/selection`). The graph writes it:
  HEAD on first open, then clicks and arrow keys. Modules read it.
- Modules can select commits too: a parent link in Commit details, or a branch in Branches. The
  graph then scrolls the commit into view.

## Modules

| Module         | Shortcut | Shows                                                                                                                                                   |
| -------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repositories   | Alt+1    | Open repositories with their submodules nested recursively, then recent repositories; open and create buttons                                           |
| Branches       | Alt+2    | Local branches, one section per remote, tags; filter; collapsible sections; current branch marked **HEAD**; a click selects the branch's commit         |
| Commit details | Alt+3    | Message, commit id (copy), parents (click to select), author and committer with their time zones, refs, and the branches and tags containing the commit |
| Changed files  | Alt+5    | The files the selected commit changed (status, renames); a merge can be compared with any parent ([changed-files.md](changed-files.md))                 |
| Stashes        | Alt+4    | Stash list (`stash@{n}`, message, branch, date); refreshed when the window regains focus                                                                |

Default arrangement: Repositories and Branches as tabs on top, Commit details, Changed files and
Stashes as tabs below. A layout saved before Changed files existed does not show it; open it
from the activity bar or with Alt+5.

Details:

- **Repositories**:
  - A click on a repository focuses its tab; a click on a submodule opens it as a repository
    tab.
  - An open submodule stays inside its parent's tree: shown in bold, and highlighted when it is
    the active repository. It is not listed again as a repository of its own.
  - Submodules that are not initialized are dimmed and cannot be opened; initializing them is M7.
  - Each open repository (and each open submodule) has a **…** button, shown on hover or focus,
    with its actions: **Copy path** and **Close** work; **Pull**, **Fetch**, **Push** (M5) and
    **Commit…** (M4) are listed disabled with their milestone. The app shell supplies the
    actions (`src/app/workbench/repositoryActions.ts`) through `RepositoryActionsContext`, so
    the Repositories module does not depend on the features that implement them. Settings can
    hide the button.
  - Recent repositories that are already open are not repeated; missing folders are dimmed.
- **Branches**:
  - The list is virtualized, so 10,000 refs (the 1M synthetic repository) scroll smoothly.
  - Refs whose target is not a commit in the graph (a tag of a tree) are dimmed.
  - Read-only: checkout, create, rename, delete and the rest are M5.
- **Commit details**:
  - "Contained in" comes from the graph, not from `git branch --contains`. It is exact for every
    ref the graph knows (branches, remote branches, tags) and takes 5.5 ms for the oldest of a
    million commits.
  - At most 500 refs are listed, followed by "and N more".
  - Children and signature status are M3.
- **Stashes**: read-only. Creating with file selection, apply, pop, drop and applying single
  files are M4.

Modules that work on the active repository share one frame (`WithActiveRepository`). It explains
"No repository open", "Opening repository…" or the error, so modules only render their content.

## Toolbar (in the title bar)

| Button  | Does                                                       |
| ------- | ---------------------------------------------------------- |
| Pull ▾  | Menu: Pull, Fetch, Fetch all remotes, Fetch and prune (M5) |
| Push    | M5                                                         |
| Commit  | M4                                                         |
| Stashes | Opens the Stashes module                                   |

The placeholder buttons look dimmed but stay focusable, so their tooltip ("Push: arrives in M5")
can also be read with the keyboard.

## Layout persistence

- One layout for all repositories: both docks, the open tabs and the sidebar width and state.
  It is saved 0.5 s after the last change into `workbench-layout.json` in the app config folder,
  and restored on the next start.
- Restored tabs in the background do not open their repositories until they are first shown.
- **Reset layout** (command palette) forgets the saved layout and rebuilds both docks with the
  default arrangement. Open tabs stay open.
- A saved layout from another version, or one that cannot be read, is ignored and the default
  is used. Modules that no longer exist are dropped from a restored layout.

## Starting and loading

- **Startup curtain** (`app/layout/StartupCurtain.tsx`): opaque while the settings and the
  window's purpose load, then translucent over the rendered window, blurred (`backdrop-blur-xl`).
  It lifts once no query or mutation has run for 200 ms, or 5 s after the first render at the
  latest (a huge repository's history has its own loading state): the blur goes to 0 and the
  curtain fades out over 0.5 s. Clicks do not reach the window under it.
- **Loading bird** (`shared/components/BirdLoader.tsx`): a flat songbird on a branch with a
  commit at each end, in the text colour (black on light, white on dark), two notes rising from
  its open beak. Still with reduced motion. `LoadingState` (every module's loading message) and
  `LoadingOverlay` (stale content kept under a blur, as in the diff tab) use it.

## Keyboard

- `F6` / `Shift+F6` move focus to the next or previous region: activity bar, modules, toolbar,
  tabs, status bar. A collapsed sidebar is skipped.
- `Alt+1` … `Alt+4` open a module.
- Each module is also in the command palette under **View** ("Show Branches", ...), next to
  **Reset layout**.
- The commit list, the Branches list and other long lists are listboxes. Arrows, Page Up/Down
  and Home/End move; Enter activates.

## Adding a module

1. Create `src/features/<module>/` with the component, and export it from its `index.ts`.
2. Add one entry to `MODULES` in `src/app/workbench/modules.ts`: `id` (never reuse one, layouts
   store it), title, icon, hotkey and component. Optionally add it to `DEFAULT_MODULE_LAYOUT`.
3. Read the active repository with `WithActiveRepository` / `useActiveRepository`
   (`features/repositories`), and the selection with `useSelectedRow` (`features/selection`).

Nothing in the docks or the activity bar changes.

## Not yet

- Several diff tabs, or a diff in its own window.
- Actions in Branches and Stashes and in the toolbar (M4, M5).
- Ahead/behind counts next to the branch.
- Dragging modules into the document dock.
- Popping panels out into windows.
