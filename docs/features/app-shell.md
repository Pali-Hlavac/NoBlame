# App shell

The main window's frame: sidebar, repository tabs, status bar, command palette, theme and About.
User guide: [main-window.md](../user-guide/main-window.md).

Status: **M1 done.** Repository tabs show a labelled placeholder until M2 reads repositories.

## Layout

- **Sidebar** (resizable, 12–40 % of the width): the list of open repositories and an "Open
  repository" button (folder picker). Clicking an entry activates its tab.
- **Tab bar**: Welcome and repository tabs. Opening a path that is already open focuses its tab
  (identity ignores trailing separators). The search button opens the command palette.
- **Status bar**: app name and version; git status button; "Commands" button with the palette
  shortcut; theme menu.

## Tabs

| Tab        | Content                                                                                                                                                                           |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Welcome    | Logo, git problems (if any), "Open repository…", shortcuts, command-line tip                                                                                                      |
| Repository | Name and path; **placeholder** notice ("opening repositories and the commit graph arrive in M2"); buttons that open Log, Commit and File history task windows (also placeholders) |

Closing the last tab shows "No open tabs" with a button to reopen Welcome. Shortcuts:
`Ctrl/⌘+W` close, `Ctrl+Tab` / `Ctrl+Shift+Tab` cycle (ignored while a dialog is open), arrow
keys move between tabs in the tab bar.

Tabs are not restored after a restart yet (M9).

## Command palette

`Ctrl+K` (`⌘K` on macOS). Commands are grouped; search ranks by the visible label first, then
by keywords. Commands in M1:

- Repository: Open repository…
- Task windows (placeholders until M8): Open _Task_ window, for each of the 14 tasks, only when
  a repository tab is active
- Tabs: Open Welcome tab, Close current tab
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

First version of the finch-on-a-branch logo: `assets/logo/noblame.svg`, copied to
`public/icon.svg` for the UI. Platform icons in `src-tauri/icons/` are generated with
`pnpm icons`. The branch doubles as a Git branch (a main line, a forked line and commit nodes).
Small-size variants and monochrome versions are M9.

## Not in M1

Persisted window size and tabs, recent repositories (M2 dashboard), menus, settings page.
