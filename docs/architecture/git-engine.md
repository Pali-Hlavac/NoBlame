# Git engine

All Git access lives in `crates/git-core`, which has no Tauri dependency
([ADR 0007](../adr/0007-git-engine.md)).

## Which tool for which operation

| Operation                                                        | Tool    | Why                                                                                                                                                      | Status               |
| ---------------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| Locate git, report version; `git init`, `git commit-graph write` | git CLI | The user's git is what will run their hooks and credentials                                                                                              | M1, M2 done          |
| History walk, commit-graph, refs                                 | `gix`   | In-process, no fork per call, streams millions of commits                                                                                                | M2 done              |
| Trees, blobs, diffs                                              | `gix`   | Same; paging and caching under our control                                                                                                               | M3 done              |
| File history                                                     | both    | `git log -- <path>` (history simplification, Bloom filters); gix finds where renamed files came from ([ADR 0022](../adr/0022-file-history-and-blame.md)) | M3 done              |
| Blame                                                            | git CLI | `git blame --incremental`: faster than gix-blame, reads `blame.ignoreRevsFile` and `.mailmap` (ADR 0022)                                                 | M3 done              |
| Working tree status                                              | git CLI | `git status --porcelain=v2 -z`, read-only: honours fsmonitor, the untracked cache and `status.*` settings. gix is benchmarked against it in M4           | Summary M2; lists M4 |
| Commit, merge, rebase, cherry-pick, revert, reset, stash         | git CLI | Hooks, signing, `rerere`, merge drivers and config behave as users expect                                                                                | M4–M6                |
| Fetch, pull, push, clone                                         | git CLI | Credential helpers, SSH, proxies, LFS                                                                                                                    | M5                   |

Rule of thumb: **reads with `gix`, writes and network with the `git` CLI.**

`gix` 0.90 is used without its default features: only `max-performance` (parallel pack access
and caches), `revision` and `sha1` are enabled, so no network, worktree or status code is
compiled in yet. SHA-256 repositories are not supported until the `sha256` feature is added.

## Opening repositories

`git_core::repo::Repository::discover(path)` (`crates/git-core/src/repo/`) searches upwards from
`path` like `git` does, so a subfolder opens the repository that contains it. It uses `gix`'s trust
mapping: repositories owned by the current user open with full trust; for any other repository the
open options set `bail_if_untrusted(true)`, so a repository that git would refuse (owned by
another user and not listed in `safe.directory`) is refused too. NoBlame never changes
`safe.directory`.

Failures are classified, not string-matched:

| `gix` error class | `RepoError`      | Error code shown to the user                                                                |
| ----------------- | ---------------- | ------------------------------------------------------------------------------------------- |
| not found         | `NotARepository` | `NOT_A_REPOSITORY`                                                                          |
| permission denied | `Untrusted`      | `UNTRUSTED_REPOSITORY` (hint: the exact `git config --global --add safe.directory` command) |
| anything else     | `Gix(message)`   | `GIT_FAILED`                                                                                |

`RepoInfo` describes what was opened: `work_dir` (none when bare), `git_dir`, `kind` (`Normal`,
`Bare`, `LinkedWorktree`, `Submodule`), `head` (`Branch(name)`, `Unborn(name)` or
`Detached(id)`), `is_shallow` and `has_commit_graph`. `Repository` is a thread-safe handle;
`local()` gives a cheap per-thread `gix::Repository`.

The commit graph built from a repository is described in
[commit-graph.md](commit-graph.md).

## Minimum git version

`MIN_GIT_VERSION` is **2.39.0** (`crates/git-core/src/cli/version.rs`). Debian 12 and Apple's
Xcode Command Line Tools ship 2.39.x, and 2.38/2.39 already have every feature we plan to use
(`merge-tree --write-tree`, `rebase --update-refs`, `commit-graph --changed-paths`). The roadmap's
tentative 2.40 was revised in ADR 0007. Older versions still run; the UI warns.

## Locating git

`git_core::cli::locate::locate_git` checks, in order:

1. `NOBLAME_GIT`: an explicit path to a git executable.
2. Every directory on `PATH`.
3. Well-known install locations:
   - Windows: `%ProgramFiles%\Git\cmd`, `%ProgramFiles(x86)%\Git\cmd`, `%LOCALAPPDATA%\Programs\Git\cmd`
   - macOS: `/opt/homebrew/bin`, `/usr/local/bin`, `/opt/local/bin`, then `/usr/bin`
   - Linux: `/usr/bin`, `/usr/local/bin`, `/bin`

On macOS `/usr/bin/git` is moved to the end: it is a shim that only works with the Command Line
Tools installed, and GUI apps get a minimal `PATH`, so Homebrew's git would otherwise never win.
The app always runs the absolute path it found, never a bare `git`.

## The command runner

`GitCommand` (`crates/git-core/src/cli/command.rs`, `run.rs`) makes the safe path the only path:

| Rule                                  | How                                                                                                                                                                                                   |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No shell, no string concatenation     | Argument vector passed to the OS                                                                                                                                                                      |
| User input is never read as an option | `arg()` accepts only `&'static str`; values go through `option(name, value)` (joined as `--name=value`), `revision()` (rejects empty, leading `-`, NUL, control characters) or `paths()` (after `--`) |
| Parseable, stable output              | `-c core.quotepath=false -c color.ui=false`, `LC_ALL=C`                                                                                                                                               |
| Never prompt                          | `GIT_TERMINAL_PROMPT=0`; stdin is null unless input is given                                                                                                                                          |
| Reads never take optional locks       | `.read_only()` adds `--no-optional-locks` and `GIT_OPTIONAL_LOCKS=0`                                                                                                                                  |
| Repository chosen explicitly          | `GIT_DIR`, `GIT_WORK_TREE`, `GIT_INDEX_FILE` and friends are cleared                                                                                                                                  |
| No console window on Windows          | `CREATE_NO_WINDOW`                                                                                                                                                                                    |
| Cancellable                           | `output(&CancellationToken)`; the child is killed on cancel or drop                                                                                                                                   |
| Bytes, not strings                    | `GitOutput { code, stdout: Vec<u8>, stderr: Vec<u8> }`                                                                                                                                                |

`run()` turns a non-zero exit into `GitError::Failed { command, code, stderr }`; `output()`
returns any exit status for commands where non-zero is meaningful (`diff --exit-code`).
`display()` gives the command as a user would type it, for logs and the "equivalent command"
shown with background jobs.

Known gap: cancelling kills only the direct `git` child. Helpers it started (ssh, credential
helpers, `sh` for aliases) keep running until they exit. The M5 job model kills process trees
(job objects on Windows, process groups elsewhere).

## Configuration and trust

NoBlame never changes global or system git config and never runs `gc` or `prune` unless asked.
The `-c` overrides above only affect how output is rendered. Untrusted repositories and
`safe.directory` are covered in [security.md](security.md).

## Tests

- Unit tests next to the code (version parsing, revision validation, locating).
- `crates/git-core/tests/cli_builder.rs`: command-line construction, no processes.
- `crates/git-core/tests/cli_run.rs`: the real git against repositories from the synthetic
  generator: version, read-only runs without `index.lock`, failures with stderr, stdin,
  cancellation, missing executables.
- `crates/git-core/tests/repo_open.rs`: opening normal, bare, linked worktree, subfolder, unborn,
  detached and shallow repositories, and a plain folder (`NotARepository`).
- `crates/git-core/tests/graph_build.rs`: the graph against real repositories, see
  [commit-graph.md](commit-graph.md).

Not covered by an automated test yet: the untrusted-repository path (it needs a repository owned
by another user).
