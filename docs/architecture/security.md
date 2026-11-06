# Security

NoBlame opens repositories people clone from anywhere, runs the user's git with their
credentials, and renders untrusted text (commit messages, file contents). This page lists the
rules and where they are enforced.

## Process boundary

- The webview never reads `.git` or spawns processes ([ADR 0002](../adr/0002-rust-owns-git-access.md)).
  Everything goes through commands that Rust validates.
- Tauri capabilities grant commands per window label: task windows (`task-*`) get fewer
  permissions than the main window. New commands are denied until granted explicitly.
- The content security policy (`tauri.conf.json`) allows only the app's own scripts and the IPC
  endpoint; `freezePrototype` is on.

## Running git

Enforced by `GitCommand` ([git-engine.md](git-engine.md)):

- Argument vectors only, never a shell string.
- Literal flags must be `&'static str`. User or repository values go through `option()`
  (`--name=value`), `revision()` (validated) or `paths()` (after `--`), so a branch named
  `--upload-pack=evil` cannot become an option.
- The absolute path of the located git is executed, never a bare `git` resolved against the
  current directory.
- `GIT_DIR`, `GIT_WORK_TREE`, `GIT_INDEX_FILE` and related variables inherited from the
  environment are cleared, so the repository is always the one chosen explicitly.
- `GIT_TERMINAL_PROMPT=0`: git never waits for input on a terminal that does not exist.

## Untrusted repositories

Repository configuration can make git run programs (`core.fsmonitor`, `core.sshCommand`,
`core.pager`, diff and merge drivers, hooks). Rules for M2 and later:

- Respect git's `safe.directory` checks; never add entries or override them. When git refuses a
  repository, tell the user why and what command would trust it, and let them decide.
- `gix` is opened with the same trust model (reduced trust for repositories owned by others).
- Hooks run only for operations the user starts (commit, merge, push), as with plain git.

## Credentials

NoBlame never stores credentials ([ADR 0012](../adr/0012-credentials-and-askpass.md)):

- Git's own credential helpers and ssh agents answer first, as configured by the user.
- When they have nothing, git or ssh runs its askpass program. For background jobs (and only
  for them) that is `noblame` itself, through `GIT_ASKPASS` / `SSH_ASKPASS`; it relays the
  prompt to the running app over `127.0.0.1` with a random per-run token, compared in constant
  time, and only for jobs that are running. The environment variable also overrides a
  repository's `core.askPass`.
- The answer goes from the dialog to git and nowhere else: it is not logged, stored or kept in
  the job. git hands it to the user's credential helper when the operation succeeds.
- Job logs, the equivalent command and failure messages have credentials written into URLs
  (`https://user:token@host`) replaced by `***` (`git_core::remote::redact_credentials`).

## Configuration

NoBlame never changes global or system git config, and never runs `gc` or `prune`, unless the
user asks. It may pass `-c` overrides that only change output formatting.

## Rendering untrusted text

React escapes text by default. Never use `dangerouslySetInnerHTML` for repository content.
Large inputs (huge diffs, long lines, binary files) are paged and truncated, so they cannot hang
the UI.

## Paths

Paths from the command line are made absolute against the caller's directory. Paths that are not
valid Unicode are refused with a clear message for now rather than altered.
