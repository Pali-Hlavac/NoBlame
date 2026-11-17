# 0017: Auto-update via the Tauri updater

- Status: Accepted
- Date: 2026-11-17
- Milestone: M9

## Context and problem

Installed NoBlame should learn about new releases and install them without the user hunting for
an installer. Updates are code the app runs, so they must be signed and verified, and a build
someone made from source must not pretend to update. The project has no update server, no
signing keys and no public repository yet; those are the owner's to create. The design has to
work the day they exist and be honest until then.

## Decision drivers

- Updates are verified with a key built into the app; an unsigned or tampered download is never
  run.
- No server to run: the feed is a file on the GitHub release.
- The user decides when to install; checking is a setting.
- Builds without a key (source builds, forks) neither check nor offer anything, and say so.
- Works for the installers the app ships: NSIS and MSI on Windows, `.app` on macOS, AppImage
  on Linux (`.deb` and `.rpm` update through the system's package tools).

## Considered options

1. The Tauri updater plugin, its JavaScript API called from the page
2. The Tauri updater plugin, driven from our Rust commands
3. Our own updater (download, verify, run the installer)

## Decision outcome

Chosen option: **2**.

- `tauri-plugin-updater` 2.14 is registered only when the build carries an update key: the
  release workflow sets `NOBLAME_UPDATER_PUBKEY` (the public half of `tauri signer generate`, a
  repository variable) and `NOBLAME_UPDATER_ENDPOINT` (the repository's
  `releases/latest/download/latest.json`), read with `option_env!` (`src-tauri/src/updates/`).
  `tauri.conf.json` has the plugin's section with an empty key (the plugin needs the section;
  the built-in key replaces it) and `requireSignedVersion`: a signature must name the version
  it was made for, so an old, genuinely signed release cannot be passed off as a new one.
- Commands, typed like the others: `get_update_support` (does this build update, which
  version), `check_for_update` (the newer release, its notes), `install_update` (download with
  `UpdateProgress` events, verify, install, restart; on Windows the installer runs passively and
  the app exits). The plugin's own JavaScript commands are not granted to any window.
- The UI (`src/features/updates/`): ten seconds after the main window starts, one check when
  Settings → Updates allows it (on by default; nothing is installed without asking), a toast
  offering the release, a dialog with its notes and **Install and restart**; About and the
  palette check on demand. A build without a key shows "This build does not update itself".
- The release workflow (`.github/workflows/release.yml`) signs the updates with
  `TAURI_SIGNING_PRIVATE_KEY` and uploads `latest.json` with the installers to a draft release;
  without the key the installers are built without updater artifacts.
- Checked locally with a throwaway key, a debug build and a feed served from this machine: the
  check found the release and its notes, the toast and dialog showed it, a download altered
  after signing was refused ("not signed with NoBlame's key") and NoBlame kept running, and a
  signature without a version was refused under `requireSignedVersion`. Installing a correctly
  signed release was not run locally (it would start the installer); the first release checks
  it (`docs/development/release.md`).

### Consequences

Good:

- Verified updates with no server; one secret and one variable turn them on.
- Source builds are honest about not updating.

Bad:

- Losing the private key means existing installs can no longer update (they keep working);
  it must be backed up.
- `.deb` and `.rpm` installs are not updated by the app.
- The first real update can only be tested once two releases exist.

## Pros and cons of the options

### Option 1: the plugin's JavaScript API

- Good: least code.
- Bad: grants the page the plugin's commands; types not from our bindings; harder to keep the
  "not set up" state in one place.

### Option 2: the plugin from Rust commands

- Good: one typed surface, the key and feed decided in Rust, errors in our wording.
- Bad: a little glue code.

### Option 3: our own updater

- Good: full control.
- Bad: signature checks and installer handling per platform are easy to get wrong.

## Links

- [docs/development/release.md](../development/release.md)
- Tauri updater: <https://v2.tauri.app/plugin/updater/>
- ADR [0016](0016-testing-strategy.md)
