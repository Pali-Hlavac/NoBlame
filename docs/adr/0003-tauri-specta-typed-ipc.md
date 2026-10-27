# 0003: tauri-specta for typed IPC

- Status: Accepted
- Date: 2026-10-27
- Milestone: M1

## Context and problem

The UI calls Rust commands and receives events. Without shared types, every command name,
argument and result shape is written twice (Rust and TypeScript) and drifts silently. A typo in a
command name or a renamed field only shows up at runtime, often in a code path nobody tested.

## Decision drivers

- Command names, arguments, results and errors must be checked by the TypeScript compiler.
- Rust stays the single source of truth; TypeScript types are generated, never hand-written.
- Stale generated code must be caught in CI.

## Considered options

1. `tauri-specta` (with `specta` and `specta-typescript`) generating `bindings.ts`
2. `ts-rs` for types plus hand-written `invoke` wrappers
3. Hand-written TypeScript types and wrappers

## Decision outcome

Chosen option: **tauri-specta**, because it generates both the types and typed command and
event wrappers from the Rust signatures.

- Versions are pinned exactly, because they are pre-releases that must move together:
  `specta = "=2.0.0-rc.26"`, `tauri-specta = "=2.0.0-rc.26"`, `specta-typescript = "=0.0.13"`
  (`src-tauri/Cargo.toml`). Upgrade them in one change.
- `src-tauri/src/ipc.rs` is the single registry: `collect_commands!` lists every command and
  `collect_events!` every event (`RepositoriesRequested` in M1).
- `disable_serde_phases()` is set: the UI always sends complete objects, so one TypeScript type
  per Rust type is enough.
- Bindings are written to `src/shared/ipc/bindings.ts` by a test (`pnpm bindings`, which runs
  `cargo test -p noblame --lib export_bindings`) and on every debug start of the app.
- CI runs the Rust tests on Linux and then `git diff --exit-code -- src/shared/ipc/bindings.ts`,
  so a forgotten regeneration fails the build.
- `bindings.ts` is excluded from ESLint and Prettier and must never be edited by hand.
- Features call commands through `src/shared/ipc/client.ts`: `unwrap(commands.x())` for fallible
  commands and `call(...)` for infallible ones. Both throw one error type, `IpcError` (ADR 0006).
- specta refuses `i64`/`u64` in exported types. Commit times will be sent as `f64` seconds and
  exact large values (sizes, ids) as strings.

Bulk data does not go through these JSON commands. The commit graph is streamed as binary
batches over a Tauri `Channel`; that format is decided in ADR 0008 (M2).

### Consequences

Good:

- Renaming a command or field in Rust breaks the TypeScript build instead of the running app.
- Doc comments on Rust items appear in the generated TypeScript, so editors show them.

Bad:

- We depend on pre-release crates; an upgrade may need code changes in `ipc.rs`.
- Debug app runs rewrite `bindings.ts`, which can show up as a diff after switching branches.

## Pros and cons of the options

### ts-rs plus hand-written wrappers

- Good: stable crate.
- Bad: command names and argument lists are still written by hand and can drift.

### Hand-written types

- Bad: no compiler help at the boundary where bugs are most likely.

## Links

- [ADR 0006](0006-error-model.md)
- [../architecture/ipc.md](../architecture/ipc.md)
