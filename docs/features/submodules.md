# Submodules

Submodules are listed in the Repositories module, nested under their repository
([repositories.md](repositories.md), [workbench.md](workbench.md#modules)). M7 slice 1
(2026-11-10) added their state, initializing and updating them, and the commits between two of
a submodule's pointers in the diff tab.

## State in the Repositories module

- **Not initialized** (not cloned or not checked out): the row is dimmed and cannot be opened;
  its tooltip says to right-click it.
- **New commits**: the submodule has another commit checked out than the one its repository's
  index records. The row says "new commits"; the tooltip names both commits.
- The tree is read with gix (`list_submodules`): `.gitmodules`, the superproject's config and
  index (`recorded`), and each initialized submodule's HEAD (`checkedOut`). It is read again on
  window focus, when the file watcher reports a change in an open repository (a submodule moved
  in a terminal), and after an update job.

## Initializing and updating

| Where                                                         | Entry                             | Runs                                                |
| ------------------------------------------------------------- | --------------------------------- | --------------------------------------------------- |
| A submodule's right-click menu, or its **…** menu             | **Initialize** (not initialized)  | `git submodule update --init --recursive -- <path>` |
| The same menus of an initialized submodule                    | **Update to the recorded commit** | the same                                            |
| The **…** menu of a repository with submodules (Open, Groups) | **Update all submodules**         | `git submodule update --init --recursive`           |
| A submodule's right-click menu                                | **Copy path**                     |                                                     |

- It runs in the submodule's parent repository (nested submodules in theirs) as a background job
  (`update_submodules`, kind `submoduleUpdate`, ADR 0011): it may clone, so it has progress,
  Cancel, the Git output window and the in-app credentials prompt. The toast says how many
  submodules moved ("1 updated", from git's `Submodule path '…': checked out '…'` lines).
- Nested submodules are initialized and updated too (`--recursive`). git honours each
  submodule's `update` setting (checkout, rebase, merge, none).
- When a submodule that would be updated has new commits (nested ones included), a dialog asks
  first and lists each one as `path: checked out → recorded`. Commits made there are kept by
  their branches or reflog; git refuses when uncommitted changes are in the way.
- Hints for failures (`submodule_hint`): local folders as URLs (git refuses `file` transport for
  submodules unless `protocol.file.allow` allows it; NoBlame does not change that), local
  changes in the way, a folder that already has files, a commit the server does not have (not
  pushed), then the clone hints (credentials, host, URL).

## Following the repository

Owner request 2026-11-16: submodules follow the commits their repository records.

- **Fetch** passes `--recurse-submodules` (Settings → Submodules → **Fetch the submodules too**,
  on by default; with **Fetch all**, only the first remote's fetch): every submodule is
  fetched. Off, git's `fetch.recurseSubmodules` decides (by default the ones whose pointers
  changed).
- **Update the submodules after pull and checkout** (off by default): pull runs `git pull
--recurse-submodules` (fetches and updates in the same job); a checkout that succeeded
  (`checkout_branch`, `checkout_commit`, `create_branch` with checkout) starts a job running
  `git submodule update --recursive` (`follow_command`, no `--init`: submodules not set up are
  left alone), when the repository has a `.gitmodules` (`branches/follow.rs`).
- **The bar** above the commits (`SubmoduleBar`): when the working tree status shows
  submodules with new commits (checked out at another commit than the index records), "x is
  not on the commit this repository records" with **Update it/them** and ×. × hides it for
  that state: the paths with their recorded and checked-out commits (`lib/drift.ts`); a pull or
  checkout that records others shows it again. The submodule list is read again whenever the
  status changes, while the bar shows.
- **Check out the recorded commit** in the right-click menu of a submodule with new commits in
  the Commit module's lists (several chosen: "of N submodules") and in Changed files for the
  working tree.
- The bar and the menus go through the same question as **Update to the recorded commit**
  (`SubmoduleUpdateDialog`, now mounted once per window), since they move submodules with new
  commits; then the update job.

## The superproject's branches in a submodule's graph

Owner request 2026-11-16. A submodule opened in a tab labels the commits its superproject's
local branches record for it: an outlined purple badge `app: main, release` after the
references, its tooltip "In app, main, release record this commit". Read with gix
(`superproject_pointers`: the repository containing the submodule's folder, then one tree
lookup per local branch, at most 2,000 branches; `get_superproject_branches` adds the rows).
Those branches move in another repository, so they are read again when the window regains
focus and when the graph reloads. Remote branches are not labelled (owner's choice).

## The diff of a submodule

Choosing a submodule in Changed files (a commit's, or the working tree's) shows, instead of a
line diff:

- where its pointer went: "Added at …", "Removed; it was at …", "Its commit changed from … to
  …", or, in the working tree, "Checked out at …; the repository records …";
- for the working tree, whether it also has changed or untracked files of its own (from
  `git status`'s `S<c><m><u>` field: `submoduleChanges` on `WorkingFileDto`);
- the commits between the two pointers, as `git diff --submodule=log` lists them: the ones
  added, and the ones removed when it went back or to another line, newest first, at most 200
  each (`get_submodule_log`, `git log` in the submodule's clone);
- "Open the submodule", once it is known to be checked out (opening its empty folder would open
  the parent instead);
- when the clone lacks one of the commits: fetch in the submodule; when it is not checked out:
  initialize it.

## Code

- `crates/git-core/src/submodule/`: `list.rs` (the tree, `recorded`, `checked_out`), `update.rs`
  (`update_command`, `updated_count`, `submodule_hint`), `log.rs` (`pointer_log`,
  `submodule_dir`, which refuses paths that leave the work tree).
- `crates/git-core/src/status/parse.rs`: `SubmoduleChanges`.
- `src-tauri/src/jobs/submodules.rs` (`update_submodules`), `src-tauri/src/inspect/submodule_log.rs`
  (`get_submodule_log`).
- `src/features/repositories/`: `SubmoduleTree.tsx`, `SubmoduleMenus.tsx`,
  `SubmoduleUpdateDialog.tsx` (+ `store/submoduleUpdate.ts`), `hooks/useSubmoduleUpdate.ts`,
  `lib/submodules.ts`, `api/submodules.ts` (`startSubmoduleUpdate`).
- `src/features/diff/`: `components/SubmoduleDiff.tsx`, `lib/submodule.ts`, `api/submodule.ts`.

## Performance

Listing reads one more HEAD per initialized submodule (gix). The pointer log runs `git log
--max-count=201` both ways: on the Linux kernel, v6.0..v6.1 (15,109 commits) took 130 ms warm
and 450 ms cold, the way back 70 ms ([performance.md](../development/performance.md)).

## Not yet

- A submodule's own status in the Repositories module (its change counts show since
  2026-11-16).
- `git submodule sync` (URLs changed in `.gitmodules`), adding and removing submodules,
  `foreach`.
- Clicking a listed commit to show it in the submodule's graph.
