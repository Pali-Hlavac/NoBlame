# Project brief: NoBlame

The product requirements, written from the kickoff brief (2026-10-27). The delivery plan, the
agreed decisions and their later changes live in [roadmap.md](roadmap.md); where the two differ,
the roadmap wins.

## What NoBlame is

NoBlame is a cross-platform (Windows, Linux, macOS) desktop Git client, built in two phases:

1. **Phase 1: the main app**, inspired by _Git Extensions_: a full Git GUI with a fast commit
   graph, diffs, blame, file history, committing with hunk and line staging, branches, remotes,
   merge, rebase, cherry-pick, conflict resolution, stash, submodules, worktrees and more.
2. **Phase 2: shell integration**, inspired by _TortoiseGit_: context menus in Windows Explorer,
   macOS Finder and Linux file managers, and optional status overlay icons. The add-ons stay
   thin: they launch the main app with a command (`noblame commit <path>`), and the app opens a
   focused window for that task.

## Who it is for

People who work on **giant repositories**: many years of history, many developers, hundreds of
thousands of commits, thousands of branches and tags, large working trees.

**Performance on huge repositories is the number-one technical requirement.** A feature that is
slow on a large repository is not done. Targets are in the roadmap and measurements in
[development/performance.md](development/performance.md).

## Product requirements

### Phase 1

- Open several repositories in tabs; recent repositories; init and clone.
- Commit graph that opens instantly and scrolls at 60 fps on repositories with 1M+ commits.
- Commit details, diffs (unified and side by side, large-diff safe), blame, file history that
  follows renames, file tree of any revision, compare any two revisions.
- Working copy: status, stage and unstage files, hunks and single lines, discard with
  confirmation, commit (amend, sign-off, signing, hooks), stash.
- Branches, tags and remotes; fetch, pull and push as cancellable background jobs with progress.
- Merge, rebase (including interactive), cherry-pick, revert, reset; conflict resolution;
  reflog.
- Submodules, worktrees, LFS, bisect, patches, user scripts, settings.
- A command-line interface whose task commands each open a focused window.

### Phase 2

- Context menus in Windows Explorer (including the Windows 11 top-level menu), macOS Finder
  and the common Linux file managers.
- Optional status overlays, backed by a background status service.

## Technical requirements

| Area            | Requirement                                                                                     |
| --------------- | ----------------------------------------------------------------------------------------------- |
| Shell           | Tauri 2 with a Rust backend                                                                     |
| Frontend        | React + TypeScript (strict) + Vite + Tailwind 4 + shadcn/ui (Radix)                             |
| State           | TanStack Query for backend data, Zustand for UI-only state                                      |
| IPC types       | `tauri-specta`; bindings generated, never written by hand                                       |
| Git reads       | `gix` (gitoxide): history walks, commit-graph, refs, trees, diffs, blame, status                |
| Git writes      | The user's installed `git` CLI, so hooks, credential helpers, signing, LFS and config just work |
| Workspace       | Cargo workspace: `crates/git-core` (no Tauri dependency, fully testable) used by `src-tauri`    |
| Commit graph    | Lane layout in Rust, binary row batches over Tauri channels, virtualized `<canvas>` rendering   |
| Entry points    | CLI parsed in Rust (`clap`), single instance forwarding arguments, any task as its own window   |
| Package manager | pnpm                                                                                            |

### Performance

- Measure, don't guess: `criterion` benchmarks for Rust hot paths plus opt-in runs against real
  large repositories, recorded in `docs/development/performance.md`.
- Never load all of something when the user sees part of it: stream, page, virtualize, cache.
- Never block the UI thread or the Tauri main thread.
- Reads never take locks the user's own `git` needs (`--no-optional-locks`, read-only `gix`).

### Git correctness

Handle what real repositories contain: CRLF/LF, binary files, renames and copies, octopus
merges, detached HEAD, shallow and partial clones, submodules, worktrees, LFS pointers, non-UTF-8
paths and messages, case-insensitive file systems, macOS Unicode normalization, Windows long
paths, unrelated histories and empty repositories. Respect the user's Git configuration and
`safe.directory`; never change global or system configuration unless the user asks. Parse only
machine-readable output with a fixed locale.

### Safety

Argument arrays only (never a shell string), `--` before paths, validated refnames, and every
destructive operation behind a confirmation that names exactly what will be lost.

### Testing

Unit tests next to the code; integration tests in `crates/git-core/tests` against real
repositories built by fixtures; a synthetic repository generator (10k / 100k / 1M commits);
Vitest + Testing Library for the frontend; CI on Windows, Linux and macOS.

### Licensing

Git Extensions (GPLv3) and TortoiseGit (GPLv2) are inspiration for behaviour and UX only; no
code is copied. The licence of every dependency is checked before it is added. NoBlame itself
is licensed under the GNU GPL, version 3 or later (`LICENSE`).

## Documentation

Documentation is a deliverable: architecture, one page per feature, a plain-language user guide,
ADRs for significant decisions, development guides and a changelog. Start at
[README.md](README.md).
