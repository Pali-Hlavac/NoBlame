# Background jobs

Status: **the job model is M5 (ADR 0011). M1 provides the building block underneath it:
cancellable git commands.**

## What exists in M1

`git_core::cli::GitCommand::output(&CancellationToken)` and `run(...)`:

- start `git` with piped stdout and stderr, no console window, and `kill_on_drop`;
- write optional stdin while reading both pipes concurrently (no deadlock on large output);
- return `GitError::Cancelled` as soon as the token is cancelled, killing the process;
- never start the process when the token is already cancelled.

Timeouts are composed from the outside with `tokio::time::timeout`; dropping the future kills
the process (used by `get_git_info`, 10 s).

### Known limitation

Only the direct child is killed. Programs git started (`ssh`, credential helpers, `sh` running
an alias) live on until they exit. On Windows, Tokio reads child pipes on blocking threads, so
such a grandchild also keeps a blocking thread busy until it exits. The job model fixes this by
starting jobs in a Windows job object or a Unix process group and killing the whole tree.

## Planned model (M5)

- A job registry in Rust: id, kind (fetch, pull, push, clone, long rebase), repository, state
  (queued, running, succeeded, failed, cancelled), started and finished times.
- Progress parsed from `--progress` output (`Receiving objects: 45% (…)`) into typed
  `JobUpdated` events; full output kept as a log (`JobLogged`).
- Cancel from the UI; the equivalent command line (`GitCommand::display`) shown for every job.
- Credentials through git credential helpers and an in-app askpass helper (ADR 0012).
- A jobs panel listing running and recent jobs.
