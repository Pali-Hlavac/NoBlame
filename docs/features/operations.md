# Changing history: merge, cherry-pick, revert, reset and the operation in progress

M6 ([roadmap](../roadmap.md)). **Slice 1 (2026-11-09)**: merging into the current branch, and
the bar above the commits while an operation is in progress (merge, cherry-pick, revert,
rebase, `git am`, bisect) with Continue, Skip and Abort. **Slice 2 (2026-11-09)**: cherry-pick,
revert and reset. Rebase, conflict resolution, the interactive rebase editor and the reflog
follow in later slices.

## Where

- **Merge into the current branch…** in the commit context menu (the commit), in the submenu of
  each branch, remote branch and tag on a commit, and in the Branches module's menu (local
  branches other than the current one, remote branches, tags).
- **Cherry-pick…**, **Revert…** and **Reset the current branch to here…** in the commit context
  menu.
- The bar appears at the top of the repository tab, under the header, whenever git has an
  operation in progress, also one started in a terminal or by a pull.

## Merge dialog

"Merge topic into main" with how:

| Choice                       | git                    |
| ---------------------------- | ---------------------- |
| Fast-forward when possible   | `git merge --no-edit`  |
| Always create a merge commit | `--no-ff`              |
| Fast-forward only            | `--ff-only`            |
| Squash                       | `--squash` (no commit) |

`--no-edit` takes git's message (`Merge branch 'topic'`); there is no terminal for an editor.
The UI passes branches by their full name (`refs/heads/topic`, `refs/remotes/origin/x`,
`refs/tags/v1`), so a branch and a tag of the same name never mix up. git writes the name into
the message as given ("Merge branch 'refs/heads/topic'"), so the backend merges by the short
name when it resolves to the same reference (`merge_name`) and keeps the full name only when it
is ambiguous. The toast says what happened: "main already contains topic",
"Fast-forwarded main to topic: 1 file changed, …", "Merged topic into main: …", "Staged the
changes of topic" (squash: commit them yourself), or "The merge stopped: some files conflict"
(12 s; the bar stays). Refusals stay in the dialog with git's words and a hint (local changes in
the way, a fast-forward that is not possible, unrelated histories).

## Cherry-pick and revert dialog

"Cherry-pick a1b2c3d4 Fix the parser" or "Revert …", applied to the current branch:

| Choice                                     | git                                                  |
| ------------------------------------------ | ---------------------------------------------------- |
| (default)                                  | `git cherry-pick --no-edit` / `git revert --no-edit` |
| Only stage the changes                     | `--no-commit`                                        |
| Note where it came from (cherry-pick only) | `-x`                                                 |
| For a merge commit: Parent 1, Parent 2, …  | `--mainline=<n>` (parent 1 chosen at first)          |

Toasts: "Cherry-picked … onto main", "Reverted …" (with git's summary line), "Staged the changes
of …", "Nothing to cherry-pick: main already has these changes" / "Nothing to revert: main no
longer has these changes", or "The cherry-pick stopped: some files conflict" (12 s; the bar
stays). A pick that becomes empty stops git with the pick in progress ("The previous
cherry-pick is now empty"); `pick` then runs `--skip`, as `--empty=drop` would (git 2.45 and
later only; the minimum is 2.39), so nothing stays in progress. git leaves `REVERT_HEAD` after
`git revert --no-commit` (not after `cherry-pick --no-commit`): the bar then shows "Reverting"
and Continue commits with git's prepared message; committing in the Commit module ends it too.

## Reset dialog

"Reset main to a1b2c3d4 Fix the parser" (HEAD when detached), with how:

| Choice                  | git       | Index and files                                                           |
| ----------------------- | --------- | ------------------------------------------------------------------------- |
| Soft                    | `--soft`  | Unchanged: the changes of the commits left behind stay staged             |
| Mixed (chosen at first) | `--mixed` | The index matches the commit; every change stays in the files             |
| Keep my changes         | `--keep`  | Files match the commit, uncommitted changes stay; refused when in the way |
| Hard                    | `--hard`  | Files match the commit; uncommitted changes to tracked files are lost     |

The dialog is the confirmation, and names what the reset takes before it runs:

- the commits that leave the branch: `get_missing_commits(HEAD, commit)`, count and the newest
  three (they stay on other branches holding them and in the reflog);
- for hard, how many files lose their uncommitted changes, from the status: `changes` (each file
  once) minus untracked files, which a hard reset keeps. The button turns red: "Reset and
  discard changes".

## The operation bar

- Its title: "Merging: Merge branch 'topic'", "Cherry-picking: a1b2c3d4 Fix the parser",
  "Rebasing feature (step 3 of 7)", "Bisecting".
- Under it: "2 files conflict: resolve and stage them, then continue", or "No conflicts left:
  continue to finish" (counted by the status).
- **Continue** (disabled while files conflict): `git <merge|cherry-pick|revert|rebase|am>
--continue` with `GIT_EDITOR=true`, so the prepared message is taken.
- **Skip** (cherry-pick, revert, rebase, `git am`): `--skip`.
- **Abort** (or **Stop bisecting**): asks first, naming what goes back and that conflict
  resolutions are lost; `--abort` (`git bisect reset`).
- Errors stay in the bar with git's words.

## Code

- `crates/git-core/src/operation/`: `pick.rs` (`pick` with `PickOptions { kind, mainline,
no_commit, record_origin }` → `PickResult`; `CONFLICT`, "could not apply" or "could not
  revert" is `Conflicts`, "is now empty" is skipped and `Empty`, "nothing to commit" is
  `Empty`), `reset.rs` (`reset` with `ResetMode`), `merge.rs` (`merge` → `MergeResult { outcome, output }`;
  exit 1 with `CONFLICT` or "Automatic merge failed" is the `Conflicts` outcome, other failures
  `Rejected`), `state.rs` (`operation_in_progress` from gix `Repository::state()`, plus
  `MERGE_MSG`, `CHERRY_PICK_HEAD`/`REVERT_HEAD` and `rebase-merge/` or `rebase-apply/` for the
  detail and step), `sequence.rs` (`run_step`).
- `src-tauri/src/operations/`: `merge_into_current`, `pick_commit`, `reset_current`, `step_operation` (reads the kind itself, so a
  stale UI cannot continue the wrong thing), each under the session's write lock; errors map to
  hints in `error.rs`. The status (`get_status`) carries `operation`, so the bar follows every
  status refresh (watcher, focus, after any change).
- `src/features/operations/`: `MergeDialog`, `PickDialog`, `ResetDialog` (+ `ResetEffects`),
  `OperationBanner`, `OperationDialogs` (mounted in the main window; `openMerge`, `openPick`,
  `openReset`). The bar reaches the repository tab through `RepositoryBannerContext`, and
  merge, cherry-pick, revert and reset reach the graph and the Branches module as `RefActions`
  (`merge`, `cherryPick`, `revert`, `reset`), so neither feature depends on this one.

## Not yet

- Rebase onto (slice 3); a conflict list with ours/theirs
  and merge tools (slice 4); the three-way merge view (ADR 0014); the interactive rebase editor;
  the reflog.
- Editing the merge message before committing; merge strategies and options (`-X ours`).
- Cherry-picking or reverting several selected commits at once; a commit range.
