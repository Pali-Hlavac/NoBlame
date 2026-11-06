# 0012: Credentials: git's helpers first, then `noblame` as askpass

- Status: Accepted
- Date: 2026-11-06
- Milestone: M5 (slice 4)

## Context and problem

Fetch, pull, push and clone may need a user name and password (or token) for HTTPS, a
passphrase for an SSH key, or a yes/no for an SSH server seen for the first time. git runs
without a terminal in NoBlame (`GIT_TERMINAL_PROMPT=0`), so until now such a job simply failed.

Users already have credential setups that work in their terminal: Git Credential Manager, the
macOS keychain, libsecret, `store`, ssh agents. Those must keep working untouched, and NoBlame
must not become one more place where secrets are kept.

## Decision drivers

- Never store or log a secret; the user's credential helper decides what is remembered.
- Whatever works in a terminal works in NoBlame, in the same order.
- Works for git (HTTPS) and ssh, on Windows, macOS and Linux, without a second program to
  ship.
- Only git started by NoBlame's own jobs can open a prompt in the app.

## Considered options

1. **`GIT_ASKPASS` and `SSH_ASKPASS` point at the `noblame` executable**, which, started that
   way, relays the prompt to the running app over localhost and prints the answer.
2. Implement a git credential helper (`credential.helper=!noblame …`): it would need changing
   the user's config or passing `-c credential.helper=` (which reorders their helpers), and it
   does not cover ssh passphrases or host keys.
3. A separate small askpass binary: one more file to sign, ship and locate on each platform.
4. Named pipes / Unix sockets instead of TCP: two implementations, same security in practice
   for a same-user, per-run token.

## Decision outcome

Chosen: **option 1**.

- Job commands get `GIT_ASKPASS` and `SSH_ASKPASS` set to `std::env::current_exe()`,
  `SSH_ASKPASS_REQUIRE=force` (OpenSSH 8.4+), and `NOBLAME_ASKPASS_ADDR` (a `127.0.0.1` port
  bound at start), `NOBLAME_ASKPASS_TOKEN` (32 random bytes per app run, `getrandom`) and
  `NOBLAME_ASKPASS_JOB`. Other git commands get none of these.
- git asks its credential helpers first; only when they have nothing does it run the askpass
  program. `GIT_ASKPASS` from the environment also takes precedence over a repository's
  `core.askPass`, so a cloned repository cannot substitute its own program for job commands.
- `main` checks those variables before parsing the command line (`askpass::run_if_helper`):
  the process sends `{token, job, prompt}` as one JSON line, reads `{answer}`, prints the
  answer and exits 0, or exits 1 without one (git then fails with its own message).
- The app (`src-tauri/src/askpass/server.rs`) compares the token in constant time, accepts
  only jobs that are running, classifies the prompt (`git_core::remote::classify_prompt`:
  user name, password, passphrase, host key, other) and sends `CredentialRequested`, flashing
  the taskbar button. The main window's dialog answers with `answer_credential`; closing it
  cancels. A prompt is given up after 10 minutes, and when its job ends.
- Answers pass through memory only: never logged, stored or sent anywhere else. Job logs, the
  command line and failure messages also have credentials in URLs replaced by `***`
  (`redact_credentials`).

### Consequences

Good:

- Credential helpers work exactly as in a terminal, and save what the user typed when git
  succeeds (`credential approve`), so the next fetch does not ask.
- One executable; verified on Windows with git 2.56 (`git credential fill`) and OpenSSH 10.5
  (`ssh-keygen -y` on an encrypted key) through the real `noblame.exe`.

Bad:

- Each prompt starts the `noblame` executable once more (it exits before any window or
  webview starts).
- OpenSSH older than 8.4 ignores `SSH_ASKPASS_REQUIRE` and uses askpass only without a
  terminal and with `DISPLAY` set; there passphrases fail as before.
- Another process of the same user can read the token from the job's environment; that user
  can read the app's memory too, so this adds no exposure.
