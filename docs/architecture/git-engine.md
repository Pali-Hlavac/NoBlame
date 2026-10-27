# Git engine

All Git access lives in `crates/git-core`, which has no Tauri dependency
([ADR 0007](../adr/0007-git-engine.md)).

## Which tool for which operation

| Operation                                                | Tool        | Why                                                                                | Status |
| -------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------- | ------ |
| Locate git, report version                               | git CLI     | The user's git is what will run their hooks and credentials                        | M1     |
| History walk, commit-graph, refs                         | `gix`       | In-process, no fork per call, streams millions of commits                          | M2     |
| Trees, blobs, diffs, blame                               | `gix`       | Same; paging and caching under our control                                         | M3     |
| Working tree status                                      | `gix` (tbd) | Must respect fsmonitor and untracked cache; benchmarked against `git status` in M4 | M4     |
| Commit, merge, rebase, cherry-pick, revert, reset, stash | git CLI     | Hooks, signing, `rerere`, merge drivers and config behave as users expect          | M4–M6  |
| Fetch, pull, push, clone                                 | git CLI     | Credential helpers, SSH, proxies, LFS                                              | M5     |

Rule of thumb: **reads with `gix`, writes and network with the `git` CLI.**

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
