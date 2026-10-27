# 0006: Error model (`AppError { code, message, hint }`)

- Status: Accepted
- Date: 2026-10-27
- Milestone: M1

## Context and problem

Errors cross three boundaries: from git or the operating system into Rust, from Rust over IPC,
and from the client into React components. Users of a Git client hit errors often (missing git,
locked index, rejected push, untrusted repository). Each error should say what happened in plain
words and what the user can do next. The UI also needs a stable value to branch on (show an
install hint, offer a retry), which must not depend on parsing message text.

## Decision drivers

- One serializable error shape for every command.
- Domain detail stays in Rust; the UI gets a category, a message and an optional hint.
- No `unwrap`/`expect` in production code; errors are values.
- The frontend handles exactly one error type.

## Considered options

1. Per-module `thiserror` enums converted into one `AppError { code, message, hint }`
2. Return `String` errors from commands
3. Serialize each module's error enum directly to the frontend

## Decision outcome

Chosen option: **per-module enums converted into `AppError`**.

- Every module defines its own `thiserror` enum: `GitError` in
  `crates/git-core/src/cli/error.rs`, `GitEnvError` in `src-tauri/src/git_env/error.rs`,
  `WindowError` in `src-tauri/src/windows/error.rs`, `StorageError` in
  `src-tauri/src/storage/error.rs`.
- Each module implements `From<ModuleError> for AppError`, which logs the technical detail with
  `tracing` and chooses the user-facing text.
- `AppError` (`src-tauri/src/error.rs`) is the only error serialized to the UI:
  `{ code, message, hint }`, with `hint` set to `null` when there is nothing useful to suggest.
  Commands return `CommandResult<T> = Result<T, AppError>`.
- `ErrorCode` values (serialized in `SCREAMING_SNAKE_CASE`): `INTERNAL`, `IO`, `INVALID_DATA`,
  `INVALID_INPUT`, `NOT_FOUND`, `GIT_NOT_FOUND`, `GIT_UNUSABLE`, `GIT_FAILED`, `CANCELLED`. New
  codes are added when the UI needs to branch on a new situation, not for every error.
- Writing rules: `message` says what happened, for an end user ("Git is not installed, or
  NoBlame cannot find it."). `hint` says what to do ("Install Git for Windows from …, or set
  NOBLAME_GIT to the full path of a git executable."). For `GIT_FAILED` the message is git's own
  stderr, because git explains its failures well.
- On the client, `src/shared/ipc/client.ts` converts command errors and Tauri framework
  rejections into one `IpcError` class with `code`, `message` and `hint`. Framework failures
  (unknown command, ACL denial) get the code `IPC_FAILURE`.
- UI components show errors with `ErrorState` (full view), `InlineError` (forms and dialogs),
  feature notices such as `GitNotice`, or the global mutation toast; all show the hint.

### Consequences

Good:

- The UI can branch on `code` without parsing text.
- Users always see a sentence and, where possible, a next step.
- Technical detail (paths, OS errors, command lines) still reaches the log.

Bad:

- Each module needs a `From` implementation, and choosing good messages takes effort.
- Mapping many domain errors to a few codes loses detail on the UI side; the log keeps it.

## Pros and cons of the options

### String errors

- Good: trivial to write.
- Bad: no stable code to branch on; message and hint mixed together.

### Serializing module enums directly

- Good: full detail in the UI.
- Bad: every internal change becomes an IPC change; the UI must know every module's errors.

## Links

- [ADR 0003](0003-tauri-specta-typed-ipc.md)
- [../architecture/ipc.md](../architecture/ipc.md)
