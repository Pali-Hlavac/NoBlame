# Background jobs

Status: **M5 slice 3 (2026-11-06)**: the job registry and Fetch. Pull, push and clone become
jobs in slices 5 and 8; credentials (ADR 0012) in slice 4. Decision:
[ADR 0011](../adr/0011-background-jobs.md).

## Running git

`git_core::cli::GitCommand` has two runners:

- `output(&CancellationToken)`: collects standard output and error, for short commands.
- `stream(&CancellationToken, on_line)`: hands over each line as it arrives
  (`OutputLine { text, stream, progress }`), for jobs. Lines git redraws (ending in `\r`) are
  marked `progress` and left out of the returned standard error; a `\r\n` line counts as a
  finished line.

Both:

- start `git` with piped output, no console window, `kill_on_drop`;
- never start when the token is already cancelled;
- put git in its own **process tree** (`cli/tree.rs`): a job object on Windows, a process group
  on Unix. Cancelling, or dropping the future, kills git and everything it started (`ssh`,
  `git-remote-https`, credential helpers, `sh` running an alias). After a normal exit nothing
  is killed, so helpers meant to outlive git stay.

Timeouts are composed from the outside with `tokio::time::timeout`; dropping the future kills
the tree (used by `get_git_info`, 10 s).

## The registry

`src-tauri/src/jobs/registry.rs`, managed as `Arc<JobRegistry>`:

| Field                     | Meaning                                                                              |
| ------------------------- | ------------------------------------------------------------------------------------ |
| `id`                      | Counts up from 1 for the app run                                                     |
| `kind`                    | `fetch` (later `pull`, `push`, `clone`)                                              |
| `title`                   | `Fetch`, `Fetch origin`, `Fetch all remotes and prune`                               |
| `repoPath`                | The path the job was started with (the repository need not be open)                  |
| `command`                 | The equivalent command line (`GitCommand::display`)                                  |
| `state`                   | `running`, `succeeded`, `failed`, `cancelled`                                        |
| `progress`                | The last progress line, parsed: phase (`Remote: ` for the server's), percent, detail |
| `message`                 | How it ended: `2 new, 1 updated`, `Already up to date`, or git's `fatal:` lines      |
| `logLines`                | Lines in the log (at most 5,000; progress updates excluded)                          |
| `startedAt`, `finishedAt` | Seconds since the Unix epoch                                                         |

- `start(JobSpec)` records the job, sends `JobUpdated`, and spawns the streaming run on the
  Tauri runtime; it returns the id at once.
- Each line: parsed with `git_core::remote::parse_progress`; finished lines go to the log.
  `JobUpdated` is sent at most every 100 ms per job while it prints.
- At the end: state and message set, `JobUpdated` sent, and finished jobs beyond the 30
  newest forgotten (running jobs are never dropped).
- `cancel(id)` cancels the job's token; the run kills the tree and ends as `cancelled`.

Commands: `list_jobs`, `get_job_log`, `cancel_job`, `fetch_repository` (see
[ipc.md](ipc.md)). Jobs live in memory only.

## Frontend

`src/features/jobs/`:

- `api/jobs.ts`: the list (`list_jobs` once, then events), a job's log (read again when
  `logLines` grows), cancel, `startFetch`.
- `hooks/useJobEvents.ts`: mounted once in the main window; merges `JobUpdated` into the list
  and toasts how a job ended (failures with **Show log**).
- `components/JobsIndicator.tsx`: the status bar entry (hidden until a job ran): the running
  job with its phase and percent, else **Jobs**; a popover lists jobs with a progress bar,
  **Cancel**, **Copy command** and the log.

When a fetch moves remote branches, the file watcher reports the refs change and an open
repository's graph reloads as for any other change.
