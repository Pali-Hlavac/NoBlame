# Remotes: fetch, pull and push (clone later)

Status: **M5 slice 3 done (2026-11-06)**: Fetch, Fetch all remotes and Fetch and prune as
background jobs, with a jobs list in the status bar; **slice 4 (2026-11-06)**: asking for
user names, passwords, SSH passphrases and unknown host keys in the app; **slice 5
(2026-11-06)**: pull (as configured, merge, rebase, fast-forward only) and push (the current
branch, any branch with options and force with lease, tags, deleting on a remote). Clone and
managing remotes are slice 8 ([roadmap](../roadmap.md#m5-branches-tags-and-remotes)). The job model is
[architecture/background-jobs.md](../architecture/background-jobs.md) (ADR 0011).

## Where

| Place                                          | Entries                                                                                                |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Toolbar: **Pull** and its ▾ menu               | Pull, Pull (merge), Pull (rebase), Pull (fast-forward only), Fetch, Fetch all remotes, Fetch and prune |
| Toolbar: **Push** and its ▾ menu               | Push (the current branch), Push… (the dialog)                                                          |
| Command palette, group "Remote"                | The same, while a repository is active (pull and push only on a branch)                                |
| Branches module and the graph's branch menus   | Local branch: Push…; remote branch: Delete on the remote…; tag: Push…, Delete on a remote…             |
| Repositories module: a repository's **…** menu | Fetch (open or closed repositories); Pull and Push there are slice 6                                   |

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

## Pull

- **Pull** runs `git pull --progress --no-edit` in the work tree: the current branch from its
  upstream, joined as the user's config says (`pull.rebase`, `pull.ff`). The menu forces a way:
  **Merge** (`--no-rebase`), **Rebase** (`--rebase`), **Fast-forward only** (`--ff-only`).
  `--no-edit` keeps git from opening an editor for the merge message.
- The toast says what happened: "Fast-forwarded: 1 file changed, 1 insertion(+)", "Merged: …",
  "Rebased", "Already up to date".
- Refusals get a next step in plain words, before git's own lines (`pull_hint`): both sides
  have new commits and no `pull.rebase` set (choose Merge or Rebase), not a fast-forward,
  conflicts (resolve, then commit or `git rebase --continue` in a terminal; conflict tools are
  M6), no upstream (Set upstream…), local changes in the way (commit or stash), detached HEAD.
- Pull needs a branch: on a detached HEAD the Pull and Push buttons are disabled.

## Push

- **Push** (the button) pushes the current branch to its upstream when that is a remote branch:
  `git push --progress --porcelain <remote> refs/heads/<branch>:refs/heads/<upstream branch>`.
  Without an upstream (or with a local one) it opens the Push dialog instead.
- **The Push dialog** (Push…, and Push… on any local branch): the remote (its upstream's, else
  `origin`, else the first), the branch name there (its upstream's, else the same name), **Make
  it the upstream** (on when it has none: `--set-upstream`), **Also push annotated tags on these
  commits** (`--follow-tags`), and **Force: replace the branch there**.
- **Force** names what would be lost before the button (red, "Force push") is pressed: the
  commits on the remote branch, as the last fetch saw it, that the local branch lacks
  (`get_missing_commits`: `git rev-list --count <remote branch> --not <local branch>`, the newest
  three listed). The push runs with `--force-with-lease=refs/heads/<name>:<the commit shown>`: if
  someone pushed since, git refuses and nothing is lost ("The remote branch moved since your last
  fetch…"). A branch that did not exist there must still not exist (an empty lease).
- **Tags**: Push… on a tag pushes `refs/tags/<name>`; with several remotes the dialog asks which.
- **Deleting on a remote**: a remote branch's **Delete on the remote…** names the commits only
  it holds (as Delete does for local branches) and runs `git push <remote> --delete
refs/heads/<name>`; the remote-tracking branch goes too. A tag's **Delete on a remote…** asks
  which remote; the local tag stays.
- The result, from `--porcelain`: "1 new", "2 updated", "1 replaced", "1 deleted", "Everything
  up to date". Refusals get a hint (`push_hint`): the remote has commits you don't (pull
  first), the lease failed, the server refused (protected branch, hook), unknown remote,
  nothing to push under that name.
- Names from the UI are checked as branch or tag names before they go into a refspec, which is
  always built from full names (`refs/heads/a:refs/heads/b`), so it can never read as an option
  or a force marker (`+`).

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
- `crates/git-core/src/remote/pull.rs` (`pull_command`, `describe_pull`, `pull_hint`), `push.rs`
  (`push_command`, `Lease`, `summarize_push`, `describe_push`, `push_hint`), `remotes.rs`;
  `branch/unique.rs` (`commits_not_in`). Tests: `tests/remote_push_pull.rs` (two clones of a
  bare repository: new branch with upstream, tag, delete, rejected push, fast-forward-only
  refusal, merge pull, force with lease refused and then allowed).
- `crates/git-core/src/remote/prompt.rs` (`classify_prompt`), `redact.rs`.
- `src-tauri/src/askpass/`: `client.rs` (the helper mode of `noblame`, checked first in
  `main`), `server.rs` (listener, pending prompts), `token.rs`, `protocol.rs`, `commands.rs`
  (`list_credential_requests`, `answer_credential`).
- `src/features/credentials/` (`CredentialPrompt`, mounted in the main window).
- `src-tauri/src/jobs/`: `registry.rs`, `fetch.rs` (opens the repository, builds the title and
  the result message), `commands.rs`, `types.rs` (`JobDto`, `JobUpdated`).
- `src-tauri/src/jobs/sync.rs` (`pull_repository`, `push_repository`, `list_remotes`),
  `target.rs` (opening the repository of a job).
- `src/features/jobs/` (`startFetch`, `startPull`, `startPush`, `startJob`);
  `src/features/branches/components/PushDialog.tsx`, `ForceWarning.tsx`, `RemoteRefDialog.tsx`,
  `lib/pushCurrent.ts`, `lib/remotes.ts`, `api/remotes.ts`; `src/app/workbench/remote.ts` and
  `remoteCommands.ts` (toolbar, palette, "…" menu).

## Performance

Fetching is bound by the network and the server. The app's share: one line callback per line
of output and at most ten `JobUpdated` events per second per job. A clone of synthetic-10k
over the pack protocol printed 411 progress lines in about a second, which the throttle turns
into about ten updates.
