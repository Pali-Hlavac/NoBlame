# Dependencies

How third-party packages are checked: known vulnerabilities, licences and where they come from.
The rules for adding a dependency are in [standards.md](standards.md#dependencies).

## What is checked

| Check                  | Tool         | Fails on                                                                                   |
| ---------------------- | ------------ | ------------------------------------------------------------------------------------------ |
| Rust advisories        | `cargo-deny` | any RustSec advisory (vulnerable, unmaintained) not accepted in `deny.toml`; yanked crates |
| Rust licences          | `cargo-deny` | a licence outside the allow list in `deny.toml` (no GPL, LGPL or AGPL)                     |
| Rust sources and bans  | `cargo-deny` | crates from anywhere but crates.io (git, other registries); `*` version requirements       |
| Shipped npm packages   | `pnpm audit` | any advisory in `dependencies` (`--prod`)                                                  |
| npm tooling (dev only) | `pnpm audit` | high or critical advisories in `devDependencies`                                           |

`deny.toml` checks all six shipping targets (Windows, Linux and macOS on x64 and arm64), so
Linux-only crates such as Tauri's gtk stack are checked from Windows too.

## Where it runs

- **CI**: `.github/workflows/dependencies.yml` on every push to `main`, every pull request,
  every Monday at 06:00 UTC (advisories are published without any change in the repository)
  and by hand (`workflow_dispatch`). It is a separate workflow from `ci.yml`, so a new advisory
  shows up as its own red check, not as a broken build.
- **Locally**: `pnpm deps:check`. It needs `cargo-deny`: `cargo install cargo-deny --locked`.
  It is not part of `pnpm check`, because it needs the network and an extra tool.

On Windows with Defender or Smart App Control, building or running `cargo-deny` from
`%TEMP%` or `~/.cargo/bin` can fail with "Access is denied"; see
[troubleshooting.md](troubleshooting.md).

## When a check fails

1. **A new advisory.** Read it. If a newer version fixes it, `cargo update -p <crate>` (or
   update the parent crate) and run the check again. If it cannot reach NoBlame (a function we
   never call, a compile-time macro, another platform), add it to `ignore` in `deny.toml` with
   a `reason` that says why. Never ignore without a reason.
2. **A yanked crate.** `cargo update -p <crate>` almost always moves to a fixed release.
3. **A licence.** Check that the licence is permissive and add it to `allow` with the reason in
   a comment, or choose another crate. Copyleft (GPL family) is never added.
4. **A source.** A git dependency or another registry needs a review first; then add it to
   `allow-git` / `allow-registry` in `deny.toml`.
5. **npm.** `pnpm update <package>`, or a `pnpm.overrides` entry when the fix is only in a
   newer version of a package one of ours pulls in. Overrides that skip a major version can
   break the parent; run `pnpm check` after.

## Accepted advisories

Kept in `deny.toml` → `[advisories] ignore`, each with its reason. As of 2026-11-14 all of them
come in through other crates, none is a direct dependency:

- `bincode` (unmaintained), via syntect and two-face: only loads the syntax sets built into the
  binary.
- `paste` and `proc-macro-error` (unmaintained): compile-time macros, no runtime code.
- `zvariant`, `zvariant_derive`, `zbus_names` (unmaintained), via zbus for the opener and
  single-instance plugins on Linux: local D-Bus only.

Not reported, but known: `glib` 0.18 has an unsound iterator (RUSTSEC-2024-0429), Linux only,
through Tauri's gtk3 stack. cargo-deny reports "unsound" advisories only for direct
dependencies. NoBlame does not use that iterator, and the fix (glib 0.20) waits on Tauri.

Also known: `minimatch` 10 (moderate, GHSA-g3hv-75wg-m249) in eslint's tooling. Below the
`high` threshold for dev tooling; it goes away when eslint updates.

Review the list when updating Tauri, syntect or specta: entries should disappear.
