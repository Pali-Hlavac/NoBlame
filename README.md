# NoBlame

<img src="assets/logo/noblame.png" alt="" width="96" align="right" />

A fast, cross-platform Git client for giant repositories (Windows, Linux, macOS), built with
Tauri 2, Rust and React.

> **Status: early development; milestones M1 to M6 of the [roadmap](docs/roadmap.md) are
> done.** The commit graph (fast on giant repositories), diffs, file history and blame,
> committing and stashing, branches and remotes, merging, rebasing (also interactively),
> cherry-pick, revert, reset, conflict resolution and the reflog work. Next: M7 (submodules,
> worktrees, LFS, bisect, patches).

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
