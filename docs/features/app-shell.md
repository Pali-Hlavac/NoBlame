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
  shortcut; theme menu. While work runs, a 2 px strip along its top edge spans the window
  (`WorkStrip`): a sliding segment, or filling up while exactly one job reports a percent
  (`useWork` in `src/app/layout/`). It covers running jobs and pending mutations that declare
  `meta.activity` (`query-client.ts`): checkout, branch and tag changes, upstreams, staging,
  commit, stash, discard, ignore, remotes, the external diff tool. A mutation counts after
  150 ms (quick ones would only flash), and its activity ("Checking out the branch…") replaces
  the version text meanwhile.

## Updates

Release builds update themselves (ADR 0017; `src-tauri/src/updates/`, `src/features/updates/`):

- Only builds made with an update key: the release workflow builds in `NOBLAME_UPDATER_PUBKEY`
  and `NOBLAME_UPDATER_ENDPOINT` (`option_env!`), and only then is `tauri-plugin-updater`
  registered. `get_update_support` says whether a build updates; About says "This build does not
  update itself" otherwise, and the palette has no **Check for updates**.
- Ten seconds after the main window starts, one check when Settings → Updates → **Look for a new
  version when NoBlame starts** is on (default). A newer release shows a toast with **See what's
  new**; the dialog shows its notes and **Install and restart** (download progress from
  `UpdateProgress`; on Windows the installer runs passively and NoBlame exits, elsewhere it
  restarts). Nothing installs without that click.
- Signatures are verified with the built-in key, and `requireSignedVersion` refuses a signature
  made for another version. A refused update leaves NoBlame as it was and says it was not
  signed with NoBlame's key.

## Profile folder

With `NOBLAME_PROFILE_DIR` set, NoBlame keeps everything under that folder instead of the
platform's: `config/` (settings, layout, recent list, groups, window places, saved filters),
`cache/` (the graph cache) and `webview/` (the webview's own storage; the folder
`WEBVIEW2_USER_DATA_FOLDER` names instead, when set, as the Edge WebDriver does; passed to the
webview explicitly, since WebView2 ignores the variable in an app run as administrator). Such an instance runs on its own: no single-instance
forwarding either way. The end-to-end tests use it (`src-tauri/src/storage/profile.rs`).

## Window places

The main window opens where it was last closed: position, size, and maximized or not. Each kind
of task window (Commit, Log, ...) opens at the size it last had, centred
(`src-tauri/src/windows/placement/`, saved in `window-state.json` in the config folder when a
window closes).

- Places are physical pixels. While a window is maximized or minimized, the place kept is its
  last one before (tracked on every move and resize).
- A saved place is used only when at least 120 × 40 px of the window's top edge would be on a
  monitor's work area; the monitor holding most of it is chosen, and a window bigger than that
  work area is shrunk and moved onto it. Otherwise the window opens centred at its default size.
- A maximized main window is shown at its saved place, then maximized, so restoring it down goes
  back there (maximizing the hidden window made Windows restore it to where it was built).

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

## App icon

Settings → Appearance → **App icon**: Cream (default, the installed program's icon), Vibrant or
Free (the finch alone, without a background; Windows and Linux only). The names were Golden and
No background before 0.2.0; saved settings with the old names still load (`serde` aliases).
`update_settings` applies a new choice at once, and new windows open with it
(`src-tauri/src/windows/icon/`):

- Windows (`win32.rs`, `ico.rs`): the hand-made `.ico` of each variant is built into the
  executable (`include_bytes!`). For each window the picture drawn for the size Windows asks for
  is made into an icon (`CreateIconFromResourceEx`), the big one (`SM_CXICON`: taskbar, Alt+Tab)
  and the small one (`SM_CXSMICON`: the title bar of task windows), at the window's DPI, and set
  with `WM_SETICON` on the main thread. The icons made are kept for the app's life (a handful).
- The taskbar (`taskbar.rs`): the installer gives NoBlame's shortcuts an app id (the bundle
  identifier), a program started from them carries it, and the taskbar then shows the
  shortcut's icon, ignoring `WM_SETICON` (found in 0.2.0: switching did nothing once
  installed; a Vite run has no app id). So each window gets an explicit
  `PKEY_AppUserModel_ID`: the identifier for Cream (same button as a pinned NoBlame),
  `<identifier>.vibrant` / `.free` otherwise, with relaunch properties (command, name, and the
  variant's `.ico` written to `<cache>/taskbar-icons/`) so that pinning such a window pins it
  with that icon. Checked by starting the build through a shortcut carrying the app id and
  switching live (taskbar screenshots); pinning not tried. A NoBlame pinned with one icon and
  running with another shows two buttons.
- Linux (`linux.rs`): the window icon, a 256 px PNG of the variant (`tauri::image::Image`,
  feature `image-png`). Desktops that match the window to an installed `.desktop` file (GNOME,
  KDE by default) show that file's icon instead, and Wayland has no window icons in general use;
  so on Linux the choice shows mainly on X11 desktops using window icons (XFCE). Not run on
  Linux yet.
- macOS (`macos.rs`): windows have no icon, so the variant becomes the Dock icon while NoBlame
  runs (`NSApplication.setApplicationIconImage`, from the owner's `.icns`). Settings offers only
  Cream and Vibrant there, previewed with the macOS pictures; a saved Free shows as Cream.
  Type-checked for `aarch64-apple-darwin` only; not yet run on a Mac.

What stays cream: the installed program's own icon (Explorer, the Start menu, shortcuts, pinned
taskbar buttons, installers; Finder and the Dock while NoBlame is closed), set at build time
from `src-tauri/icons/`.

## About

Logo, tagline, version, platform and the git in use (version, "needs 2.39.0+" warning, path),
handy for bug reports. **Third-party licences…** shows the notices of every open-source
component (`src-tauri/resources/third-party-notices.txt`, made by `pnpm licences`, embedded with
`include_str!` and installed beside the app), split at each licence and filtered by what is
typed (`features/about/lib/notices.ts`).

## Logo

The finch on a branch, by the owner (2026-10-29; per-system icons 2026-11-18). The owner's
pictures are in one folder per system, each with the variants `cream`, `vibrant` and `free`:

- `assets/logo/windows/*.ico`: hand-made, every size drawn (16 to 256 px).
- `assets/logo/mac/*.icns` (cream and vibrant only; 128 to 1024 px, the rounded square inside
  Apple's margin), with their 1024 px sources `source_*.png`.
- `assets/logo/linux/*.png`: 1024 px, transparent.

`pnpm icons` (`scripts/icons.mjs`) runs `tauri icon` on `linux/cream.png` for every generated
size in `src-tauri/icons/` (the bundles' PNGs, the Windows Store logos), makes 256 px
`linux-vibrant.png` and `linux-free.png` the same way, then puts the hand-made `.ico` and `.icns`
files over the generated ones (`icon.ico`, `vibrant.ico`, `free.ico`, `icon.icns`,
`vibrant.icns`) and writes the Settings previews to `public/icon-*.png`. A Rust test
(`windows/icon/mod.rs`) fails when the `.ico` and `.icns` files in `src-tauri/icons/` differ from
the hand-made ones. The PNGs at the top of `assets/logo/` (`noblame*.png`) are earlier copies of
the Linux pictures. The Affinity
Photo source (`no_blame_icon.afphoto`) stays out of the
repository. The songbird alone on a transparent background
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
