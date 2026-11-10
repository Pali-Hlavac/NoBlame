# Worktrees

The **Worktrees** module (Alt+9, M7 slice 2, 2026-11-10) lists the worktrees of the active
repository: the main one and the linked ones (`git worktree`), each a folder with its own
checked-out branch, sharing one history.

## The list

- One row per worktree, the main one first (`list_worktrees`: `git worktree list --porcelain
-z`): the folder's name, badges (**main**, **this tab**, a lock with its reason, **folder
  gone**), then what it has checked out (the branch, "detached at …", "bare repository", "no
  commit yet") and the full path.
- Clicking a row opens it as a repository tab (or shows its tab). A worktree whose folder is
  gone, or a bare main repository, cannot be opened.
- The list is keyed under the repository's references and read again when the file watcher
  reports refs, or a change in `.git/worktrees/<name>` (the folder itself, or its `gitdir`,
  `HEAD` or `locked` file, not its index: `RepositoryChanged.worktrees`), so worktrees added,
  removed, locked or switched in a terminal show up; every change made here reads it again
  at once. Paths use the platform's separators
  (git prints `/` on Windows), so a worktree opened here and one picked in a folder dialog are
  the same tab.

## Actions

| Where                    | Entry                                                      | Runs                                                             |
| ------------------------ | ---------------------------------------------------------- | ---------------------------------------------------------------- |
| Toolbar                  | **Add a worktree…**                                        | `git worktree add [-b <name> \| --detach] -- <folder> [<start>]` |
| Toolbar                  | **Prune worktrees whose folders are gone…**                | `git worktree prune --verbose` (only when some are gone)         |
| Toolbar                  | Refresh                                                    |                                                                  |
| A row's right-click menu | **Open**                                                   | opens it as a repository tab                                     |
| A row's right-click menu | **Lock…** / **Unlock** (not the main one)                  | `git worktree lock [--reason=…]` / `unlock`                      |
| A row's right-click menu | **Remove…** (not the main one, this tab's or a locked one) | `git worktree remove [--force] -- <folder>`                      |
| A row's right-click menu | **Copy path**                                              |                                                                  |

- **Add a worktree** checks out a new branch (name checked as typed, starting at the current
  branch by default), an existing branch (only those not checked out in another worktree: git
  allows one each), or a commit without a branch. The folder is suggested next to the main
  worktree (`app-<branch>`) until edited, and shown in full below the field; **Browse…** picks
  one. It must be a full path that
  does not exist yet or an empty folder (checked by git-core before git runs). **Open it when
  done** (on) opens the new worktree as a tab.
- **Remove** counts the worktree's uncommitted files first (`get_change_counts`). Without any,
  it says the folder is deleted (ignored files with it) and that the branch stays; with some, it
  names them ("2 new and 1 changed files not committed") and the button becomes **Remove with
  its changes** (`--force`). The backend refuses this tab's own worktree; git refuses locked
  ones.
- **Prune** lists the worktrees it forgets; their branches stay. Locked ones stay until
  unlocked.

## Code

- `crates/git-core/src/worktree/`: `list.rs` (`parse_worktrees`, `list_worktrees`), `manage.rs`
  (`add_worktree`, `check_worktree_folder`, `remove_worktree`, `lock_worktree`,
  `unlock_worktree`, `prune_worktrees`). Errors are `BranchError`s (git refusing, a bad name).
- `src-tauri/src/worktrees/` (not `worktree/`, which is the working tree's status): commands,
  service (each change holds the session's write lock; `current` compares canonical paths).
- `src/features/worktrees/`: `WorktreesModule`, `WorktreeMenu`, `AddWorktreeDialog` with
  `WorktreeCheckoutFields`, `WorktreeDialogs` (remove, lock, prune), `lib/worktrees.ts`,
  `api/worktrees.ts`, `store/dialog.ts`. `joinPath` and `parentOf` moved to
  `src/shared/lib/paths.ts` (shared with the Clone dialog).

## Not yet

- Moving a worktree (`git worktree move`), repairing one (`git worktree repair`).
- "Check out in a new worktree" from the Branches module and the commit menu.
- Change counts on the rows.
