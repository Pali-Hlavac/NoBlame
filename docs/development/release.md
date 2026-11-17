# Releases

How a NoBlame release is made: versions, the release workflow, signing, updates, and the checks
before publishing. Decisions: ADR [0017](../adr/0017-auto-update.md) (updates) and
[0016](../adr/0016-testing-strategy.md) (tests).

## Before the first public release (owner decisions)

These cannot be undone cheaply, so they come first:

- **Licence** of NoBlame itself (open question in the roadmap): add it as `LICENSE`, the
  `license` field in `Cargo.toml` (`[workspace.package]`) and `package.json`, and drop
  `private = { ignore = true }` from `deny.toml` and `scripts/licences/about.toml` if needed.
- **Identifier**: `com.noblame.client` in `src-tauri/tauri.conf.json` is a placeholder. The
  settings folder is named after it, so changing it after release moves everyone's settings.
- **GitHub repository**: the workflows (`.github/workflows/`) run there, and the update feed
  lives on its releases.
- **Keys and certificates** (below): the update key at least; code signing for Windows and macOS
  so the systems do not warn about an unknown publisher.

## Secrets and variables of the repository

Set under Settings → Secrets and variables → Actions. Each is optional: what is missing is
skipped, and the build says so in its log.

| Name                                 | Kind     | What it does                                                                                                  |
| ------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------- |
| `NOBLAME_UPDATER_PUBKEY`             | variable | The public update key, built into the app; without it releases do not update themselves                       |
| `TAURI_SIGNING_PRIVATE_KEY`          | secret   | Signs the updates (`.sig` files, `latest.json`)                                                               |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | secret   | Its password                                                                                                  |
| `WINDOWS_CERTIFICATE`                | secret   | Authenticode certificate, `.pfx` as base64 (`[Convert]::ToBase64String([IO.File]::ReadAllBytes("cert.pfx"))`) |
| `WINDOWS_CERTIFICATE_PASSWORD`       | secret   | Its password                                                                                                  |
| `APPLE_CERTIFICATE`                  | secret   | Developer ID Application certificate, `.p12` as base64                                                        |
| `APPLE_CERTIFICATE_PASSWORD`         | secret   | Its password                                                                                                  |
| `APPLE_SIGNING_IDENTITY`             | secret   | For example `Developer ID Application: Name (TEAMID)`                                                         |
| `APPLE_ID`, `APPLE_PASSWORD`         | secret   | Apple ID and an app-specific password, for notarization                                                       |
| `APPLE_TEAM_ID`                      | secret   | The team id                                                                                                   |

The update key pair, once:

```sh
pnpm tauri signer generate -w ~/.tauri/noblame.key
```

The private key file and its password go into the two secrets; the `.pub` file's content into
the variable. **Back the private key up**: without it, installed copies can never be updated
again (they keep working).

## Versioning

- Semantic versioning. The version lives in `Cargo.toml` (`[workspace.package] version`),
  `package.json` and `src-tauri/tauri.conf.json`.
- `CHANGELOG.md` follows [Keep a Changelog](https://keepachangelog.com/): every change adds a
  line under `[Unreleased]`.
- `pnpm release:version 0.2.0` sets the version in the three files and turns `[Unreleased]` into
  `[0.2.0] - <today>` under a new, empty Unreleased section (`scripts/release-version.mjs`).

## Making a release

1. `pnpm check` and `pnpm e2e` pass on `main`; the manual checklist's new items are done.
2. `pnpm licences` if dependencies changed (CI fails otherwise).
3. `pnpm release:version 0.2.0`, then `cargo check` (updates `Cargo.lock`), review the
   changelog section, and commit: `chore: release 0.2.0`.
4. Tag and push: `git tag v0.2.0 && git push origin main v0.2.0`.
5. The release workflow (`.github/workflows/release.yml`) checks the tag against the three
   versions and the changelog, then builds on Windows (x64: NSIS and MSI), macOS (universal:
   `.app`, `.dmg`) and Ubuntu 22.04 (AppImage, `.deb`, `.rpm`; the oldest supported glibc). It
   signs what the secrets allow (`scripts/release-config.mjs` writes the additions to
   `tauri.conf.json`) and uploads everything to a **draft** release with `latest.json`.
6. Check the draft (below), paste the changelog section into its text, then publish it. Only a
   published release is `releases/latest`, which the update feed points at.

## Checks before publishing

- Each installer installs and starts; About shows the version; `noblame --version` prints it.
- Windows: the installer and `noblame.exe` show the publisher (Properties → Digital
  Signatures) when signed. macOS: `spctl -a -vv /Applications/NoBlame.app` says "accepted,
  source=Notarized Developer ID" when notarized.
- About → Third-party licences lists the components; `third-party-notices.txt` is beside the
  installed app.
- **Updates** (from the second release on): install the previous release, publish the new one,
  then in the old one About → Check for updates finds it, **Install and restart** downloads,
  installs and starts the new version. The first time this is done, record it in ADR 0017: the
  installing step was not run before the first release.

## Building locally

```sh
pnpm app:build
```

Produces unsigned installers for the current OS in `target/release/bundle/`, without updates
(no key is built in). The executable is named `noblame` (`mainBinaryName`) so the command line
works after installation.

## Third-party notices

`src-tauri/resources/third-party-notices.txt` lists every open-source component in the app with
its licence; installers place it beside the app and About shows it. Regenerate it after
changing dependencies: `pnpm licences` (CI fails on an outdated file: `pnpm licences --check`
in the dependency workflow). A crate under a licence `deny.toml` does not allow fails the
generation as well.

## Still open

- Put `noblame` on `PATH` after installation (a Windows installer option, a macOS symlink
  helper; Linux packages already install it to `/usr/bin`).
- Windows on Arm (arm64) builds.
- `.deb` and `.rpm` installs are updated by the system's package tools, not by NoBlame; an apt
  or rpm repository would be needed for that.
