# Getting started

How to build, run and test NoBlame from source.

## Prerequisites

All platforms:

| Tool    | Version                       | Notes                                                                                    |
| ------- | ----------------------------- | ---------------------------------------------------------------------------------------- |
| Rust    | 1.100 (`rust-toolchain.toml`) | via [rustup](https://rustup.rs), which installs that version with `rustfmt` and `clippy` |
| Node.js | at least 22.12                |                                                                                          |
| pnpm    | 9.15 (see `packageManager`)   | `corepack enable` picks the right version                                                |
| git     | at least 2.39                 | NoBlame runs the user's git; tests run it too                                            |

### Windows

- Microsoft C++ Build Tools ("Desktop development with C++") and the Windows SDK.
- WebView2 runtime (preinstalled on Windows 10 21H2+ and Windows 11).
- Git for Windows (provides `sh`, which one cancellation test uses through a git alias).
- If Windows Defender or Smart App Control blocks freshly built programs ("Access is denied"
  when cargo runs a build script), add an exclusion for the repository folder.

### macOS

- Xcode Command Line Tools: `xcode-select --install`.
- Optionally a newer git: `brew install git`.

### Linux (Debian/Ubuntu)

```sh
sudo apt-get install -y libwebkit2gtk-4.1-dev libxdo-dev libssl-dev \
  libayatana-appindicator3-dev librsvg2-dev build-essential git
```

Other distributions: see the [Tauri prerequisites](https://tauri.app/start/prerequisites/).

## Install and run

```sh
pnpm install          # also installs the git hooks (husky)
pnpm app:dev          # builds the Rust side and opens the app with hot reload
```

Pass command-line arguments after two `--`:

```sh
pnpm app:dev -- -- log .           # opens a Log task window for the current folder
pnpm app:dev -- -- C:\src\linux    # opens a repository tab
```

While the dev app runs, `target/debug/noblame <args>` (`noblame.exe` on Windows) behaves like a
second launch: it forwards its arguments to the running app and exits.

## Test and check

| Command          | What it does                                      |
| ---------------- | ------------------------------------------------- |
| `pnpm test`      | Vitest (frontend)                                 |
| `pnpm test:rust` | `cargo test --workspace` (needs `git` on `PATH`)  |
| `pnpm lint`      | ESLint and the file-size check                    |
| `pnpm lint:rust` | Clippy with warnings as errors                    |
| `pnpm typecheck` | TypeScript, app and tooling configs               |
| `pnpm format`    | Prettier and rustfmt                              |
| `pnpm check`     | Everything CI runs; must pass before work is done |
| `pnpm bindings`  | Regenerates `src/shared/ipc/bindings.ts`          |

## Synthetic repositories

```sh
pnpm repos:generate                   # 10k and 100k commits into .cache/repos/
pnpm repos:generate --preset 1m       # 1M commits (minutes, about 1 GB)
```

See [development/testing.md](development/testing.md) and
[development/performance.md](development/performance.md).

## Build installers

```sh
pnpm app:build
```

Signing, notarization and the release workflow arrive in M9; see
[development/release.md](development/release.md).
