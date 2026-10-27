# 0002: Rust owns all Git access; the webview never touches the repository

- Status: Accepted
- Date: 2026-10-27
- Milestone: M1

## Context and problem

A Git client reads untrusted data (repositories cloned from anywhere) and runs programs (the
user's `git`, hooks, credential helpers). The UI is a webview that renders repository content:
commit messages, file names, diffs. If the webview could read files or start processes, any bug
that lets repository content run script in the webview would become a way to run programs on the
user's machine.

We also need one place that enforces the rules for running git safely and quickly (argument
arrays, `--` before paths, `--no-optional-locks`, fixed locale), instead of rules spread across
UI code.

## Decision drivers

- Security: a compromised webview must not be able to read arbitrary files or run programs.
- Performance: repository reads must happen in native code, with data streamed to the UI.
- One enforcement point for git safety rules.

## Considered options

1. Only Rust touches repositories and processes; the webview calls typed commands.
2. Give the webview the Tauri `fs` and `shell` plugins and run some reads from TypeScript.

## Decision outcome

Chosen option: **only Rust touches repositories**.

- The webview never reads `.git`, never reads repository files directly and never spawns
  processes. It calls commands registered in `src-tauri/src/ipc.rs`.
- Git logic lives in `crates/git-core`, which has no Tauri dependency. All git processes are
  started through `git_core::cli::GitCommand` (`crates/git-core/src/cli/command.rs`), see
  ADR 0007.
- The app does not include the Tauri `fs` or `shell` plugins. `tauri-plugin-dialog` is only used
  to let the user pick a folder; the chosen path is passed back to Rust.
- Every app command is listed in `APP_COMMANDS` in `src-tauri/build.rs`, which generates an
  `allow-<command>` permission. Unlisted commands are rejected at runtime.
- Permissions are granted per window type:
  - `src-tauri/capabilities/main.json` (window `main`): app info, settings, git info, window
    context, repository requests, opening task windows, and `dialog:allow-open`.
  - `src-tauri/capabilities/task.json` (windows `task-*`): app info, settings, git info and
    window context only. Task windows cannot open folder pickers or other windows yet.
- `tauri.conf.json` sets a strict CSP (`script-src 'self'`, no remote origins) and
  `freezePrototype: true`.

### Consequences

Good:

- A script injection in the UI can only call the commands its window is allowed to call.
- Git safety rules are enforced in one crate and covered by its tests.
- `git-core` can be tested with plain `cargo test` against real fixture repositories.

Bad:

- Every new capability needs a command, a permission entry in `build.rs` and a grant in a
  capability file. Forgetting a step shows up as "not allowed" at runtime (documented in
  `CLAUDE.md` → Gotchas).
- Large data (the commit graph) cannot be sent as JSON commands efficiently; it needs the binary
  channel planned in ADR 0008.

## Links

- [ADR 0006](0006-error-model.md), [ADR 0007](0007-git-engine.md)
- [../architecture/security.md](../architecture/security.md)
