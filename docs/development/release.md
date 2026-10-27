# Releases

Status: **draft.** Releases, signing, notarization and auto-update are milestone M9
(ADR 0017). Until then NoBlame is built from source ([getting-started.md](../getting-started.md)).

## Versioning

- Semantic versioning. The version lives in `Cargo.toml` (`[workspace.package] version`),
  `package.json` and `src-tauri/tauri.conf.json`; keep the three equal.
- `CHANGELOG.md` follows [Keep a Changelog](https://keepachangelog.com/): every change adds a
  line under `[Unreleased]`; a release renames that section to the version and date.

## Building

```sh
pnpm app:build
```

Produces the installers for the current OS in `target/release/bundle/` (MSI and NSIS on Windows,
`.app` and `.dmg` on macOS, AppImage, `.deb` and `.rpm` on Linux). The executable is named
`noblame` (`mainBinaryName`) so the command line works after installation.

## Open items for M9

- Choose the licence (open question in the roadmap).
- Reverse-DNS identifier: `com.noblame.client` is a placeholder. Changing it later moves the
  settings folder, so decide before the first public release.
- Code signing (Windows Authenticode, Apple Developer ID) and macOS notarization in a release
  workflow.
- Put `noblame` on `PATH` after installation (Windows installer option, macOS symlink helper,
  Linux packages install to `/usr/bin`).
- Updater keys and update feed for the Tauri updater plugin.
