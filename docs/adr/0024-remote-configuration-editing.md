# 0024: Editing a remote's configuration: CLI writes, all or nothing, secrets kept back

- Status: Proposed (slice 1 built; accepted when M10 is done)
- Date: 2026-11-19
- Milestone: M10

## Context and problem

The remote editor (M10) shows every useful setting of a remote: its URLs, what it fetches, how it
pushes, the branches tracking it, HTTP and SSH connection settings, credentials and LFS. Until now
people edited most of these by hand in `.git/config`. One save often changes several keys at
once (a rename plus new push URLs plus `tagOpt`), some keys hold several values (`url`,
`pushurl`, `fetch`, `push`), some values hold secrets (a password in a URL, a token in
`http.extraHeader`), and settings may also come from the user's or the system's files.

## Decision drivers

- Never corrupt or half-change a remote: a save is all or nothing.
- Never lose a value of a multi-valued key, never reorder them.
- Never send a password or token to the webview (ADR 0012).
- Behave as git does: the user's git reads what NoBlame writes, includes and all.
- Show what will happen before it happens.

## Considered options

1. Write `.git/config` with gix's config writer.
2. `git config --local` per key with the CLI, a plan checked first, undone on failure.
3. Write the file ourselves, atomically (a temp file renamed over).

## Decision

Option 2.

- **Reading**: `git config --list --show-origin --show-scope -z` once, every scope, so the editor
  shows inherited values with their file. Only the sections the editor shows cross IPC
  (`remote`, `url`, `branch`, `push`, `pull`, `fetch`, `http`, `credential`, `lfs`).
- **Secrets**: passwords in URLs (`https://ada:***@host`; the user name stays, it is part of the
  address) and `extraHeader` values (`Authorization: ***`) are hidden in the backend. The editor
  sends back, per key, the values it was shown (`before`) and the values wanted (`after`). A
  wanted value equal to a shown one is the real value it stands for, so saving keeps the
  secret; a new value with `***` in it is refused.
- **Plan**: per key, the repository's own values are compared with `before` (refused when they
  differ: another program changed them) and turned into steps: `--unset-all`, then `--add` per
  value for several values; `--replace-all` for one; `--unset-all` for none. The plan's command
  lines, secrets hidden, are what the review shows.
- **Apply**: keys in order, then the default branch (`git remote set-head`), then the name
  (`git remote rename`, last because it moves the section the keys are in). When a step fails,
  every key already touched gets its earlier values back (clear, then write them), then the default
  branch; the message says whether everything is back. A key whose first step failed is
  untouched and not rewritten.
- **Scope**: only `--local`. Settings that apply to every remote of the repository are labelled
  so; editing the user's settings stays in Settings → Git settings.
- **Not git config**: the SSH key per remote (slice 5) is NoBlame's own setting, passed as
  `GIT_SSH_COMMAND` when NoBlame runs git for that remote, because git has no per-remote SSH key
  setting (`core.sshCommand` is per repository).

## Consequences

- Good: git itself writes, so its locking, quoting, includes and case rules apply; a terminal sees
  exactly what was saved. Several values round-trip. Secrets stay in the backend.
- Good: the review lists real commands, which also teaches what the settings are.
- Bad: one git process per step (a save of ten keys runs ten or more). Saves are rare and each
  takes milliseconds.
- Bad: not atomic at the file level: another program writing the config during a save could
  interleave. The before-check narrows this to the save itself.
- Rejected option 1: gix writes the file but does not take git's lock the same way and would
  reformat sections; option 3 would reimplement git's config format and lose comments.
