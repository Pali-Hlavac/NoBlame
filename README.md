# NoBlame

<img src="assets/logo/noblame.svg" alt="" width="96" align="right" />

A fast, cross-platform Git client for giant repositories (Windows, Linux, macOS), built with
Tauri 2, Rust and React.

> **Status: early development (milestone M1 of the [roadmap](docs/roadmap.md)).** The app shell,
> command line and git detection work; repositories are not read yet. The commit graph arrives
> in M2.

- Phase 1: a full Git GUI inspired by Git Extensions.
- Phase 2: file-manager context menus inspired by TortoiseGit that open NoBlame's task windows
  (`noblame commit <path>`).

## Quick start

```sh
pnpm install
pnpm app:dev
```

Prerequisites per OS: [docs/getting-started.md](docs/getting-started.md). Documentation index:
[docs/README.md](docs/README.md). Contributor map: [CLAUDE.md](CLAUDE.md).

NoBlame is a Git client; it is not affiliated with or endorsed by the Git project.
