# 0020: Workbench docking with dockview

- Status: Accepted
- Date: 2026-10-28
- Milestone: M2.5

## Context and problem

The owner wants a Git Extensions-like workbench ([design/workbench.md](../design/workbench.md)):

- an activity bar that opens modules in a left dock, where they stack as tabs or split;
- a main dock where repository tabs and the diff tab can be split and docked left, right, top or
  bottom, as in VS Code;
- one saved layout, with the open tabs restored between sessions.

The UI is expected to keep changing. New modules and tab kinds must not need layout code, and
layout code must not know what a module shows.

## Decision drivers

- Tabs, splits in every direction, drag and drop, resizing and serialization, without writing
  our own docking engine.
- Theming with our design tokens in light and dark.
- Keyboard access for tabs.
- Works with React 19; small dependency tree; permissive licence (MIT or similar).
- The canvas commit graph must keep resizing correctly inside docked panels.
- The layout must survive app updates: unknown modules or broken data fall back to defaults.

## Considered options

1. **dockview** (`dockview-react` 8.4.1, MIT): React bindings over a zero-dependency core.
   Groups of tabs, splits in every direction, floating groups, popouts and `toJSON`/`fromJSON`.
   Themed through CSS variables.
2. **flexlayout-react** 0.11.1 (MIT): a JSON model with tabsets, borders and splitters, and its
   own model actions.
3. **Our own**: nested `react-resizable-panels` groups (already a dependency) plus a tab strip.

## Decision outcome

Chosen option: **1, dockview**. It covers every driver out of the box, it is themed with plain
CSS variables mapped onto our tokens, and its panel and group API maps directly onto "open a
module" and "open a tab".

flexlayout-react was compared on its documentation and API, not built: its model-action API would
have forced every "open/focus" through model transactions. Option 3 was rejected because splits
in every direction plus drag and drop is exactly the code we do not want to own.

How it is used (`src/features/workbench/`):

- **Two dockview instances**:
  - the module dock (left sidebar, inside a collapsible `react-resizable-panels` panel);
  - the document dock (main area).

  The activity bar and the "collapse sidebar" behaviour stay ours.

- **The tabs store is the source of truth for what is open**: `features/workspace`, `useTabsStore`.
  - `DocumentDock` reconciles dockview with it (`lib/reconcile.ts`: add missing panels, close
    removed ones, sync titles and the active tab).
  - The user's clicks and closes in the dock are written back to the store.
  - Events caused by reconciling are ignored.
  - Everything that worked on the tabs store before (repository list, session cleanup, palette,
    `Ctrl+Tab`) keeps working unchanged.
- **dockview decides where things are**: groups, splits, sizes. The app never hard-codes a
  position. The default module arrangement is data (`DEFAULT_MODULE_LAYOUT` in
  `src/app/workbench/modules.ts`).
- **Module registry**: `WorkbenchModule { id, title, icon, hotkey?, component }`.
  - The app shell lists the modules (`src/app/workbench/modules.ts`).
  - Panels store only the module id; tabs store their `WorkspaceTab` in the panel params.
- **Layout persistence**:
  - `{ version, modules, documents, sidebar }` is saved through `save_workbench_layout`, debounced
    500 ms, into `workbench-layout.json` in the app config folder.
  - The backend treats it as opaque JSON (`Layout`, exported as `unknown`). The frontend validates
    it (`lib/layout.ts`).
  - On start, `restoreWorkbench` puts the saved tabs into the store before anything renders. Then
    each dock runs `fromJSON`.
  - A wrong version, unreadable tabs or a throwing `fromJSON` fall back to the default
    arrangement. "Reset layout" deletes the saved layout and remounts both docks.
- **Restored tabs mount when first shown**, so background tabs do not open their repositories at
  start-up.
- **Floating groups and popouts are disabled** until "pop out into a window" is designed for
  Tauri windows (backlog).
- **Theme**: `components/dockview-theme.css` maps every `--dv-*` variable onto our tokens. The
  active tab of the active group gets a primary-coloured top line.

### Consequences

Good:

- A new module is one component plus one registry entry; a new tab kind is one `WorkspaceTab`
  variant plus one `renderTab` case. Neither touches docking code.
- Users can split repository tabs and the future diff tab in any direction. The arrangement
  survives restarts.
- Layout bugs can be fixed with "Reset layout" instead of deleting files by hand.

Bad:

- Two sources of state (store and dock) must stay in sync. Reconciling is idempotent and tested
  with a fake dock (`reconcile.test.ts`), but this remains the most delicate code in the frame.
- Modules cannot be dragged between the module dock and the document dock (two instances).
- dockview releases often (8.4 → 8.7 in three weeks). `dockview-react`, `dockview` and
  `dockview-core` are pinned to the same exact version through `pnpm.overrides`, and must be
  upgraded together.
- The serialized layout contains dockview's format. A dockview upgrade that changes it shows up
  as a reset layout, not as an error.

## Pros and cons of the options

### Option 2: flexlayout-react

- Good: mature; "borders" are a built-in concept close to an activity bar plus sidebar.
- Bad: every change goes through model actions; theming is through its own CSS classes; we would
  still need our own activity bar to match the design.

### Option 3: our own on react-resizable-panels

- Good: no new dependency; full control.
- Bad: drag-and-drop docking, tab groups and serialization would all be ours to build and test.

## Links

- [design/workbench.md](../design/workbench.md), [roadmap M2.5](../roadmap.md)
- [ADR 0004](0004-frontend-stack.md) (frontend stack), [ADR 0005](0005-code-organization.md)
