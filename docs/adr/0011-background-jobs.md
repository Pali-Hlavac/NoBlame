# 0011: Background jobs: a registry in Rust, streamed git, process trees killed

- Status: Accepted
- Date: 2026-11-06
- Milestone: M5 (slice 3)

## Context and problem

Fetch, pull, push and clone talk to remotes. They take from under a second to many minutes,
can wait for a password, and git prints their progress only as `\r`-redrawn lines on standard
error. The user must be able to keep working, see how far each one got, cancel it, and read
what git said when it failed. Several can run at once (fetch all repositories of a group).

Cancelling a git command so far killed only `git` itself (ADR [0007](0007-git-engine.md)).
`git fetch` runs `git-remote-https` or `ssh`, which kept running and, on Windows, kept a Tokio
blocking thread reading the pipe until they exited.

## Decision drivers

- The UI never freezes, and a job never needs its repository tab: the Repositories module
  fetches closed repositories (slice 6).
- Cancel means stopped: no helper left talking to the server.
- Progress reaches the UI promptly but without flooding the IPC channel (a clone of 77k
  objects prints ~400 progress lines in a second).
- Failures show git's words; the full output and the equivalent command stay available.

## Considered options

1. **A job registry in the Rust app** that runs git with a streaming runner, sends typed
   `JobUpdated` events (throttled) and keeps logs for the UI to read on demand.
2. Run git from the frontend through Tauri's shell plugin: breaks ADR 0002 (only Rust touches
   repositories) and puts argument building in TypeScript.
3. Poll a "job status" command from the UI: simpler events, but either laggy or chatty.

For cancelling the tree: a Windows **job object** and a Unix **process group**, versus
`taskkill /T` (a second process per cancel, racy once git has exited) or tracking children by
hand (impossible from outside).

## Decision outcome

Chosen: **option 1, with process trees killed through job objects and process groups**.

- `git_core::cli::GitCommand::stream(cancel, on_line)` reads both pipes as data arrives and
  splits lines at `\n` and `\r`; `\r` lines are marked `progress` and left out of the captured
  standard error. `cli/tree.rs` puts the child in a new job object (Windows,
  `windows-sys` `Win32_System_JobObjects`) or process group (Unix, `process_group(0)` and
  `rustix::process::kill_process_group`). The tree is killed when the run is cancelled or its
  future dropped, never after a normal exit (an ssh control master may stay). The ordinary
  `output()` runner uses the same tree, so every cancelled git command now stops its helpers.
- `git_core::remote`: `fetch_command` (`git fetch --progress [--prune] [--all | <remote>]`),
  `parse_progress` (phase, remote or local, percent, counts, the rest) and `summarize_fetch`
  (new, updated, pruned, rejected references from git's update lines).
- `src-tauri/src/jobs/`: `JobRegistry` (managed as `Arc`) holds every job of the app run:
  id, kind, title, repository path, command line, state (running, succeeded, failed,
  cancelled), last progress, message, log (5,000 lines at most), times. It keeps running jobs
  and the 30 newest finished ones. `JobUpdated { job }` goes out when a job starts, at most
  every 100 ms while it prints, and when it ends. Commands: `fetch_repository` (returns the id
  at once), `list_jobs`, `get_job_log`, `cancel_job`.
- The repository is opened with `Repository::discover` before a fetch starts, so an untrusted
  repository is refused exactly as when opening it; no session is needed.
- Frontend `features/jobs`: the list is a TanStack Query entry kept current from events
  (`useJobEvents`, mounted once in the main window, also toasts how each job ended); the
  status bar's `JobsIndicator` shows the running job and lists all with progress, cancel, the
  command line and the log.

### Consequences

Good:

- Cancelling a fetch stops `git-remote-https` and `ssh` too, and no blocking thread is left
  waiting on Windows.
- Pull, push and clone (slices 5, 8) are a new `JobSpec` each: a command and a way to
  describe the result.
- The output window (slice 7) reads the same logs.

Bad:

- Jobs live in memory: they are gone when the app restarts.
- A job object per git command costs two system calls; measured as noise next to starting git.
- If the app itself runs in a job that forbids nesting (Windows 7), the tree cannot be held and
  only git is killed, as before (logged).
- Credentials are not asked for yet (`GIT_TERMINAL_PROMPT=0`): a remote that needs a password
  fails with git's message until ADR 0012 (slice 4).
