# Architecture decision records

An ADR records one significant or expensive-to-reverse decision: the context, the options we
considered, what we chose and what it costs us. ADRs are numbered and never deleted. When a
decision changes, write a new ADR that supersedes the old one and update the old one's status.

| ADR                                              | Topic                                                             | Milestone | Status   |
| ------------------------------------------------ | ----------------------------------------------------------------- | --------- | -------- |
| [0001](0001-tauri-2-desktop-shell.md)            | Tauri 2 as the desktop shell                                      | M1        | Accepted |
| [0002](0002-rust-owns-git-access.md)             | Rust owns all Git access; the webview never touches the repo      | M1        | Accepted |
| [0003](0003-tauri-specta-typed-ipc.md)           | tauri-specta for typed IPC                                        | M1        | Accepted |
| [0004](0004-frontend-stack.md)                   | Frontend stack (React, TanStack Query, Zustand, shadcn/ui)        | M1        | Accepted |
| [0005](0005-code-organization.md)                | Code organization (workspace, feature folders, modules)           | M1        | Accepted |
| [0006](0006-error-model.md)                      | Error model (`AppError { code, message, hint }`)                  | M1        | Accepted |
| [0007](0007-git-engine.md)                       | Git engine: gix for reads, git CLI for writes; minimum git        | M1        | Accepted |
| [0008](0008-binary-graph-blocks.md)              | Binary graph blocks fetched on demand                             | M2        | Accepted |
| [0009](0009-canvas-graph-and-lane-layout.md)     | Canvas graph rendering and lane layout                            | M2        | Accepted |
| [0010](0010-on-disk-graph-cache.md)              | Reuse the commit index between builds; cache it on disk           | M2        | Accepted |
| [0011](0011-background-jobs.md)                  | Background jobs: registry, streamed git, process trees killed     | M5        | Accepted |
| [0012](0012-credentials-and-askpass.md)          | Credentials: git's helpers first, then `noblame` as askpass       | M5        | Accepted |
| [0013](0013-diff-viewer.md)                      | Diff viewer: diffs computed in Rust, rows paged                   | M3        | Accepted |
| [0014](0014-conflict-resolution-ui.md)           | Conflict resolution: list, sides, merge tool, built-in merge view | M6        | Accepted |
| [0015](0015-cli-single-instance-task-windows.md) | CLI, single instance and task windows                             | M1        | Accepted |
| [0016](0016-testing-strategy.md)                 | Testing strategy                                                  | M9        | Accepted |
| [0017](0017-auto-update.md)                      | Auto-update via the Tauri updater                                 | M9        | Accepted |
| 0018                                             | Shell integration architecture                                    | T1        | Planned  |
| 0019                                             | Status cache service and overlays                                 | T4        | Planned  |
| [0020](0020-workbench-docking.md)                | Workbench docking with dockview                                   | M2.5      | Accepted |
| [0021](0021-graph-filters.md)                    | Graph filters as views of the loaded graph                        | M3        | Accepted |
| [0022](0022-file-history-and-blame.md)           | File history and blame: git for the walks, gix for renames        | M3        | Accepted |
| [0023](0023-compare-revisions.md)                | Comparing two revisions: `git diff --raw`, gix in partial clones  | M3        | Accepted |

The kickoff prompt asked for ADRs 0001-0008 in M1. The ADR plan in
[../roadmap.md](../roadmap.md) is newer and wins: ADR 0008 (binary commit stream) is written in
M2 together with the code it describes, and ADR 0015 (CLI and task windows) is written in M1
because M1 builds that code. ADR 0008 was planned as "binary commit stream over Tauri
channels"; the decision taken in M2 is on-demand binary blocks instead (see the ADR).

## Writing an ADR

1. Copy [template.md](template.md) to `NNNN-short-title.md` with the next free number (or the
   number reserved in the roadmap's ADR plan).
2. Describe the problem before the solution. List the options you really considered, including
   the one you rejected for good reasons.
3. Be concrete: name files, crates, versions and limits. A reader should be able to find the code
   that implements the decision.
4. Write down the bad consequences too. They are what the next reader needs most.
5. Add the ADR to the table above and set its status in the roadmap's ADR plan.
