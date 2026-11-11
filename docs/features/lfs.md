# Git LFS

M7 slice 5. The **Git LFS** module (Alt+0): a repository's LFS files, whether each has its
content or only its pointer, downloading contents, and the locks on the LFS server. User guide:
[user-guide/lfs.md](../user-guide/lfs.md).

## Files

`get_lfs` (`src-tauri/src/lfs.rs`, git-core `lfs.rs`): `git lfs version` says whether git-lfs is
installed (the module says how to get it when not); `git lfs ls-files --long --size` lists the
LFS files of the commit checked out as `<oid> <*|-> <path> (<size>)`. `*` means the working tree
has the content; `-` means only the pointer (cloned with `GIT_LFS_SKIP_SMUDGE=1`, or
`lfs.fetchexclude`), shown as **pointer only**. The size is git-lfs's wording (`3.0 KB`). At most
20,000 files are read and 2,000 listed. The query is keyed under the status, so the watcher's
changes read it again.

**Download contents** runs `git lfs pull` as a background job (kind `lfsPull`, cancellable); the
files are read again when it ends.

Diffs of LFS files show their pointers (the `oid` and `size` lines), which is what the history
holds.

## Locks

Locks live on the LFS server (GitHub, GitLab, Bitbucket, …), so they are read only when asked
(**Show locks**): `git lfs locks --json`. **Lock** on a file row runs `git lfs lock -- <path>`;
**Unlock** runs `git lfs unlock --id=<id>`. When the server refuses (someone else's lock), a
confirmation names the owner and explains what forcing means before `--force`. Usual refusals
get a next step (`lfs_hint`): no LFS server for the remote (a `file://` or plain SSH remote),
git-lfs not installed, a lock already held.

## Not yet

- Tracking patterns (`git lfs track`) and migrating history (`git lfs migrate`).
- Showing locks in the graph's files or the Commit module, and lock-aware read-only files
  (`lockable` attribute).
- Fetching only some files (`--include`).
