# Patches and archives

M7 slice 4. Saving patches of a commit or a range, applying patch files (as commits or only to
the files), and saving an archive of a commit. User guide:
[user-guide/patches.md](../user-guide/patches.md).

## Where

- Commit menu → **More** → **Create patches…** and **Save an archive…** (the archive is named
  after a tag on the commit, else its short id).
- **Apply patches…**: the toolbar's **Commit** button menu, and the command palette
  (Repository group).

## Creating patches

`CreatePatchDialog` (`src/features/patches`). Commits: the commit alone, or the commits after a
base (a branch, tag or commit typed in; counted 300 ms after typing stops) up to it. A merge
commit starts on the range: a patch cannot hold a merge, and `git format-patch` leaves merges
out. The count (`count_patches`: `rev-list --count --no-merges` and `--merges` over `tip^!` or
`base..tip`, after `rev-parse --verify` of each end) says how many are left out.

Save as one file (`git format-patch --output=<file>`: a mailbox) or one file per commit in a
folder. Per-commit files are written to a temporary folder first, then copied: when a file of
the same name is in the chosen folder, nothing is written and the refusal names the files
(git would replace them). At most 1,000 commits at once (`MAX_PATCH_COMMITS`). The file or
folder is chosen with the system dialog from Rust (`patches/ask.rs`): the webview never names a
path the app writes.

## Applying patches

`ApplyPatchesDialog`. Files are chosen with the system's open dialog (several at once) and
applied in the order of their names. For each, `read_patch_file` (git-core `patch/mailbox.rs`)
says what it holds: mails (subject without `[PATCH n/m]`, author, RFC 2047 encoded words
decoded; a mail without changes, such as a cover letter, is flagged), a plain diff, or nothing
git could apply. Only the first 64 MB of a file are read for this.

The check (`check_patches`, keyed under the status so it follows the working tree):
`git apply --numstat -z` lists the files changed (the same path counted once, first 500 listed);
`git apply --check` (with `--index` for commits) says whether they apply as they are, else
`git apply --check --3way` whether a three-way merge applies them cleanly or with conflicts.
The files go to git as one stream on standard input: given as separate files, git applies each
to the original files, so a second patch to the same file would fail.

How:

- **Make commits from them** (only when every file holds mails): `git am --3way -- <files>`.
  A mail that does not apply stops it with `git am` in progress; the operation bar shows
  Continue, Skip and Abort (M6).
- **Only change the files**: `git apply` (not staged); when that fails, `git apply --3way`
  (staged, possibly with conflicts to resolve).

Usual refusals get a next step (`patches/error.rs`): a dirty index, an earlier `git am` or
rebase in progress, unstaged changes in a file the merge touches, not a patch.

## Archives

`ArchiveDialog`: zip or tar.gz, optionally inside a folder (default `<repository>-<name>`;
checked by `archive_prefix`: relative, no `.`/`..`, no `\`). **Save…** asks where, then runs
`git archive --format=… --prefix=… --output=<file>.partial <revision>` as a background job
(kind `archive`, cancellable, ADR 0011). The file is renamed once git succeeded; a failed or
cancelled job removes only the `.partial` file, never the file it was to replace. Submodules'
files are not included (git archives only the repository's own tree).

## Not yet

- Signing off patches, cover letters and other `format-patch` options (git's `format.*`
  config applies).
- Applying a patch to the index only, or with `--reject`.
- Archiving a subfolder only.
