# Remotes: fetch (and later pull, push, clone)

Status: **M5 slice 3 done (2026-11-06)**: Fetch, Fetch all remotes and Fetch and prune as
background jobs, with a jobs list in the status bar; **slice 4 (2026-11-06)**: asking for
user names, passwords, SSH passphrases and unknown host keys in the app. Pull and push are
slice 5 ([roadmap](../roadmap.md#m5-branches-tags-and-remotes)). The job model is
[architecture/background-jobs.md](../architecture/background-jobs.md) (ADR 0011).

## Where

| Place                                          | Entries                                                          |
| ---------------------------------------------- | ---------------------------------------------------------------- |
| Toolbar: **Pull ▾** menu                       | Fetch, Fetch all remotes, Fetch and prune (Pull itself: slice 5) |
| Command palette, group "Remote"                | The same three, while a repository is active                     |
| Repositories module: a repository's **…** menu | Fetch (open or closed repositories)                              |

## Behaviour

- **Fetch** runs `git fetch --progress`: git picks the current branch's remote, else
  `origin`. **Fetch all remotes** adds `--all`, **Fetch and prune** `--prune` (remote branches
  deleted on the remote go too).
- Each fetch is a job: it starts at once and the UI stays usable. The status bar shows
  "Fetch: Receiving objects 45%" while it runs (with "+1" when more run); clicking it lists
  running and recent jobs: a progress bar with git's phase, size and speed, the time taken,
  **Cancel**, **Copy command** and **Log** (git's output, the command line first).
- When it ends, a toast says what changed: "Fetch: 2 new, 1 updated, 1 pruned", "Already up to
  date", or "Fetch failed" with git's `fatal:` lines and **Show log**. Cancelled jobs say so.
- **Cancel** kills git and everything it started (`git-remote-https`, `ssh`), so nothing goes on
  talking to the server.
- The repository is checked like when opening it (an untrusted one is refused, with the
  `safe.directory` hint). It need not be open: the Repositories module fetches closed ones.
- An open repository's graph, branches and upstream counts reload when the fetch moves remote
  branches (the file watcher sees the refs change).
- Credentials: see below.

## Credentials

([ADR 0012](../adr/0012-credentials-and-askpass.md), [security](../architecture/security.md#credentials))

- git's credential helpers (Git Credential Manager, keychain, libsecret, `store`) and ssh
  agents answer first, as in a terminal. NoBlame changes no config.
- When nothing answers, git or ssh asks NoBlame (askpass). The main window shows a dialog
  naming the job and the repository, with git's or ssh's own question:
  - **User name** (shown as typed), **Password or token**, **Passphrase** (hidden), or an
    answer for anything else (hidden);
  - an **unknown server**: the fingerprint ssh printed, **Trust and connect** (`yes`) or
    **Don't connect** (`no`; also on Escape).
- **Cancel** or Escape: git fails with its own message ("could not read Username"). A prompt
  nobody answers is given up after 10 minutes; one whose job ends (cancelled) closes.
- Several prompts wait in order; the taskbar button flashes when the app is in the background.
- The answer goes to git only; git gives it to the credential helper when the fetch succeeds,
  so the next one does not ask. Credentials written into URLs are shown as `***` in logs and
  messages.
- Needs OpenSSH 8.4 or later for ssh prompts (`SSH_ASKPASS_REQUIRE=force`).

## Code

- `crates/git-core/src/remote/`: `fetch.rs` (`fetch_command`, `summarize_fetch`),
  `progress.rs` (`parse_progress`). `crates/git-core/src/cli/stream.rs` and `tree.rs`. Tests:
  `tests/remote_fetch.rs`, `tests/cli_stream.rs`.
- `crates/git-core/src/remote/prompt.rs` (`classify_prompt`), `redact.rs`.
- `src-tauri/src/askpass/`: `client.rs` (the helper mode of `noblame`, checked first in
  `main`), `server.rs` (listener, pending prompts), `token.rs`, `protocol.rs`, `commands.rs`
  (`list_credential_requests`, `answer_credential`).
- `src/features/credentials/` (`CredentialPrompt`, mounted in the main window).
- `src-tauri/src/jobs/`: `registry.rs`, `fetch.rs` (opens the repository, builds the title and
  the result message), `commands.rs`, `types.rs` (`JobDto`, `JobUpdated`).
- `src/features/jobs/`; `src/app/workbench/fetch.ts` (the toolbar, palette and "…" entries).

## Performance

Fetching is bound by the network and the server. The app's share: one line callback per line
of output and at most ten `JobUpdated` events per second per job. A clone of synthetic-10k
over the pack protocol printed 411 progress lines in about a second, which the throttle turns
into about ten updates.
