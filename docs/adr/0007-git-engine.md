# 0007: Git engine: gix for reads, the git CLI for writes; minimum git version

- Status: Accepted
- Date: 2026-10-27
- Milestone: M1

## Context and problem

NoBlame must read history, refs, trees, diffs, blame and status very fast on repositories with
hundreds of thousands of commits. It must also commit, merge, rebase, stash, fetch, pull and push
in a way users trust: hooks run, credential helpers and SSH agents work, commits are signed as
configured, LFS filters apply, and every setting in the user's git config is respected.

## Decision drivers

- Read performance on giant repositories, without spawning a process per read.
- Write and network behaviour identical to the user's own `git`.
- Safety: user and repository data must never be interpreted as options or shell syntax.
- Supporting the git versions users actually have.

## Considered options

1. `gix` for reads, the installed `git` CLI for writes and network
2. `git2` (libgit2) for everything
3. The `git` CLI for everything
4. `gix` for everything

## Decision outcome

Chosen option: **gix for reads, git CLI for writes and network**.

- Reads use `gix` (added in M2 with the history walk). They open repositories read-only and never
  take locks the user's own git needs.
- Writes and network operations run the user's `git` as a subprocess. Hooks, credential helpers,
  signing, LFS and config then behave exactly as in a terminal.
- libgit2 was rejected: it differs from git in config, hooks, credentials and newer features, and
  is slower than gix for history walks.

### Minimum git version: 2.39.0

`MIN_GIT_VERSION` in `crates/git-core/src/cli/version.rs`. The roadmap said "tentatively 2.40";
this ADR revises it to **2.39.0** because Debian 12 and Apple's Xcode Command Line Tools ship
2.39.x, and 2.39 already has what we use (`merge-tree --write-tree`, `rebase --update-refs`,
`commit-graph --changed-paths`, `--porcelain=v2`, `switch`). An older git is detected and
reported (the status bar shows a warning) rather than refused outright.

### Running git safely

All processes go through `GitCommand` (`crates/git-core/src/cli/command.rs` and `run.rs`):

- `arg(&'static str)` only accepts literals written in the source code (subcommands, flags).
- `option(name, value)` joins into one argument, `--name=value`, so a value can never become a
  separate option.
- `revision(&str)` validates first (`args.rs`): not empty, no leading `-`, no NUL or control
  characters.
- `paths(...)` adds `--` once, then the paths.
- Every command gets `-c core.quotepath=false -c color.ui=false`, so parsers see raw paths and
  no color codes.
- `read_only()` adds `--no-optional-locks` and sets `GIT_OPTIONAL_LOCKS=0`.
- Environment: `LC_ALL=C` and `GIT_TERMINAL_PROMPT=0`; inherited `GIT_DIR`, `GIT_WORK_TREE`,
  `GIT_INDEX_FILE`, `GIT_OBJECT_DIRECTORY`, `GIT_ALTERNATE_OBJECT_DIRECTORIES`,
  `GIT_NAMESPACE` and `GIT_PREFIX` are removed.
- Windows: `CREATE_NO_WINDOW`, so no console window flashes.
- Output is kept as bytes (`GitOutput`), because paths and messages may be non-UTF-8.
- Cancellation: `output(&CancellationToken)` races the process against the token; the child is
  created with `kill_on_drop(true)`, so a cancelled or dropped command kills it.

### Locating git

`crates/git-core/src/cli/locate.rs`: the `NOBLAME_GIT` override first, then every `PATH` entry,
then well-known directories (`Git\cmd` under Program Files and LocalAppData on Windows;
Homebrew, `/usr/local/bin` and MacPorts on macOS; `/usr/bin`, `/usr/local/bin`, `/bin` on
Linux). On macOS `/usr/bin/git` is only a shim for the Command Line Tools, so it is tried last.
The absolute path is always executed, never a bare `git`.

### Consequences

Good:

- Fast reads and fully faithful writes.
- Injection through revisions, paths or option values is prevented by construction.

Bad:

- Two implementations of Git semantics; tests must check that gix reads match git's view.
- Users must install git; the app explains how when it is missing or too old.
- **Known gap**: cancelling kills only the direct `git` child. Helpers it started (ssh,
  credential helpers, alias shells) keep running and can hold its output pipes open. Process-tree
  termination (job objects on Windows, process groups on Unix) arrives with the job model in M5
  (ADR 0011).

## Links

- [ADR 0002](0002-rust-owns-git-access.md), [ADR 0011 (planned)](README.md)
- [../architecture/git-engine.md](../architecture/git-engine.md),
  [../architecture/security.md](../architecture/security.md)
