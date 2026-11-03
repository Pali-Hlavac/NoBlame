# App shell

The main window's frame: tabs, status bar, command palette, theme and About. The layout around
them (activity bar, module dock, document dock, toolbar) is the [workbench](workbench.md). User
guide: [main-window.md](../user-guide/main-window.md).

Status: **M1 done; M2 in progress; M2.5 done.** The Welcome tab is a dashboard and repository
tabs show the real commit graph ([repositories.md](repositories.md),
[commit-graph.md](commit-graph.md)).

## Layout

- **Workbench**: activity bar, module dock, toolbar and the document dock holding the tabs
  ([workbench.md](workbench.md)). Opening a path that is already open focuses its tab (identity
  ignores trailing separators).
- **Status bar**: app name and version; git status button; "Commands" button with the palette
  shortcut; theme menu.

## Tabs

| Tab        | Content                                                                                                                                                                                                 |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Welcome    | Dashboard: logo, git problems (if any), "Open repository…", "Create repository…", recent repositories, shortcuts, command-line tip                                                                      |
| Repository | Header (name, HEAD, kind and shallow badges, path, Log/Commit/File history task window buttons, which are placeholders until M8), the commit-graph offer when the file is missing, and the commit graph |

Closing the last tab shows "No open tabs" with a button to reopen Welcome. Shortcuts:
`Ctrl/⌘+W` close, `Ctrl+Tab` / `Ctrl+Shift+Tab` cycle (ignored while a dialog is open).

Open tabs and how they are split are restored after a restart (M2.5,
[workbench.md](workbench.md#layout-persistence)).

## Command palette

`Ctrl+K` (`⌘K` on macOS). Commands are grouped; search ranks by the visible label first, then
by keywords. Commands:

- Repository: Open repository…, Create repository…
- Task windows (placeholders until M8): Open _Task_ window, for each of the 14 tasks, only when
  a repository tab is active
- Tabs: Open Welcome tab, Close current tab
- View: Show _Module_ (one per module, with its `Alt+n` shortcut), Reset layout
- Appearance: Theme: System / Light / Dark
- Help: Check git installation again, About NoBlame

Edge case fixed during M1 verification: the palette used to rank by the command id, so typing
"about" selected "Close current tab" (a fuzzy match on `tabs.close`). Items now use the label as
their search value; a regression test covers it.

## Theme

System, light or dark, saved in `settings.json` in the platform config directory and applied
before first paint (the app waits for settings while showing "Starting…"). "System" follows the
OS live. Colour tokens are defined once in `src/app/styles.css` (teal primary from the logo,
goldfinch-yellow focus ring).

## About

Logo, tagline, version, platform and the git in use (version, "needs 2.39.0+" warning, path),
handy for bug reports.

## Logo

The finch on a branch, by the owner (2026-10-29): `assets/logo/noblame.png` (1024 px master)
and `assets/logo/noblame.ico` (hand-made, 16 to 256 px). `pnpm icons` generates the platform
icons in `src-tauri/icons/` from the PNG (including `icon.icns` for macOS), then
`scripts/icons.mjs` puts the hand-made `.ico` in place of the generated one and copies the 256 px
icon to `public/icon.png` (the page icon). The songbird alone on a transparent background
(`assets/logo/songbird.png`, 1254 × 1254) is shown in the title bar (28 px high, so it is easy to
spot), on the Welcome tab, in About and in task windows, from a 320 px copy in
`public/songbird.png` (made by hand: the transparent border trimmed, then 320 px wide; `pnpm icons`
does not resize it). The branch doubles as a Git branch: three commit nodes on a forked line. The
owner's refreshed artwork (finch, icon and songbird) replaced the first painted one on
2026-11-03; the first, drawn SVG logo is in the git history. The source of the loading picture,
a chirping songbird on a berry branch, is archived in
`assets/chirping birb/Chirping-Songbird-on-Berry-Branch.svg` (the app draws it from
`shared/lib/loadingBird.ts`). Small-size variants and monochrome versions are M9.

## Not yet

Persisted window size (M9), menus, settings page.
