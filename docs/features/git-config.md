# Git settings

M7 slice 7. **Settings → Git settings** edits Git's own settings (`git config`) of the
repository in view or of the user. User guide: [user-guide/git-settings.md](../user-guide/git-settings.md).

## Explicit and named

- **Which file** is always chosen first: **This repository's** (`--local`, `.git/config`) or
  **Your user settings** (`--global`, `~/.gitconfig`, every repository). The file git uses is
  shown (`--show-origin`), or that it does not exist yet. System settings are never shown or
  written.
- **Common settings** are listed by name with what they do and typical values (`lib/gitConfig.ts`:
  `user.name`, `user.email`, `pull.rebase`, `fetch.prune`, `push.autoSetupRemote`,
  `init.defaultBranch`, `core.autocrlf`, `commit.gpgSign`, `merge.ff`), each with its value in
  that file or "not set". The file's other settings follow, and **Add** sets any other one.
- Nothing is written until **Save**, **Remove** or **Add** for that one setting.

## Commands

`get_git_config` (`git config --<scope> --list --show-origin -z`; a missing file reads as empty),
`set_git_config` (`git config --<scope> --replace-all -- <key> <value>`: every value is
replaced, and a value starting with `-` stays a value) and `unset_git_config`
(`--unset-all -- <key>`), in `src-tauri/src/git_config.rs` and git-core `config.rs`. Keys are
checked first (`section.name` or `section.sub.name`, letters, digits and `-`).

## Not yet

- Settings with several values (`remote.origin.fetch`) are shown once per value but saved as one.
- Choosing values from a list (true/false), and the settings of included files
  (`include.path`).
