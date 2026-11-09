# Changing history: merge, cherry-pick, revert, reset, rebase and the operation in progress

M6 ([roadmap](../roadmap.md)). **Slice 1 (2026-11-09)**: merging into the current branch, and
the bar above the commits while an operation is in progress (merge, cherry-pick, revert,
rebase, `git am`, bisect) with Continue, Skip and Abort. **Slice 2 (2026-11-09)**: cherry-pick,
revert and reset. **Slice 3 (2026-11-09)**: rebasing the current branch onto a commit, branch or
tag. **Slice 4 (2026-11-09)**: the conflicted files with Use ours, Use theirs, Mark resolved and
the external merge tool. The three-way merge view, the interactive rebase editor and the reflog
follow in later slices.

## Where

- **Merge into the current branch…** in the commit context menu (the commit), in the submenu of
  each branch, remote branch and tag on a commit, and in the Branches module's menu (local
  branches other than the current one, remote branches, tags).
- **Rebase the current branch onto this…** / **onto it…** in the same places as merge.
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

## Rebase dialog

"Rebase topic onto origin/main". Named before it runs (`get_rebase_preview`):

- the commits replayed: HEAD's commits that `onto` lacks (count and the newest three); they get
  new ids. None: "topic has no commits of its own since origin/main: it simply moves to it";
- in red, when some of them are on a remote-tracking branch (`--remotes`): they were pushed, so
  the branch must be force pushed afterwards and anyone who built on them has to rebase too.

| Choice                                 | git                                                                      |
| -------------------------------------- | ------------------------------------------------------------------------ |
| Stash my uncommitted changes meanwhile | `--autostash` (ticked when tracked files changed), else `--no-autostash` |
| Keep merge commits                     | `--rebase-merges`                                                        |

`--no-autostash` is passed when unticked, so `rebase.autoStash` in the config does not overrule
the dialog. Toasts: "Rebased topic onto origin/main" (with the force push advice when commits
were pushed), "topic already contains origin/main", "Rebased topic, but your stashed changes
conflict" (git exits 0, leaves conflict markers and keeps the stash), or "The rebase stopped:
some files conflict" (the bar: "Rebasing topic (step 2 of 3)").

## Resolving conflicts

**Resolve…** in the bar (while files conflict), or **Resolve conflicts…** on a conflicted file
in the Commit module, opens the list (`get_conflicts`: `git ls-files -u -z`, the kind from which
index stages a path has: 1 base, 2 ours, 3 theirs). It follows the status, so files resolved in
a merge tool, an editor or a terminal leave it by themselves. It names the sides
(`lib/conflicts.ts`): ours is the current branch and theirs what comes in (the merged branch
from `Merge branch 'x'`, the picked commit, the revert, the patch); during a rebase ours is the
branch rebased onto and theirs the commit being replayed (git's naming).

| Per file                        | git                                                                                                   |
| ------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Merge tool (both sides have it) | `git mergetool --no-prompt --tool=<tool> -- <path>`                                                   |
| Use ours / Use theirs           | `git checkout --ours` or `--theirs`, then `git add`; `git rm` where that side deleted it ("(delete)") |
| Mark resolved                   | `git add` (`stage_files`)                                                                             |
| Use ours / theirs for all       | the same for every listed file                                                                        |

**The merge tool** (`open_merge_tool`) is chosen in Settings → Diff → Merge tool for conflicts:
Git's `merge.tool`, or a preset by git's own name (`vscode`, `bc`, `kdiff3`, `meld`,
`p4merge`), or any name git knows (`mergetool.<name>.cmd`). `git mergetool` starts it as from a
terminal, waits until it is closed and stages the file when the tool reports success
(`trustExitCode`) or the file changed; `mergetool.keepBackup` (git's default: true) leaves a
`.orig` copy. The command returns after 1.5 s: "Opened … in the merge tool" while it runs (no
write lock is held meanwhile; the watcher reports the staged file), or at once "Resolved" or
"still conflicts" when it closed already. A tool git cannot start ("is not available", "cmd not
set") is an error with a hint. git exits 0 with "No files need merging" for a file without a
conflict; that is reported as such, not as resolved.

## The operation bar

- Its title: "Merging: Merge branch 'topic'", "Cherry-picking: a1b2c3d4 Fix the parser",
  "Rebasing feature (step 3 of 7)", "Bisecting".
- Under it: "2 files conflict: resolve and stage them, then continue", or "No conflicts left:
  continue to finish" (counted by the status).
- **Continue** (disabled while files conflict): `git <verb> --continue` (merge, cherry-pick,
  revert, rebase, am) with `GIT_EDITOR=true`, so the prepared message is taken.
- **Skip** (cherry-pick, revert, rebase, `git am`): `--skip`.
- After Continue or Skip, `step_operation` reads the state again and says where it is: finished
  ("The rebase is finished"), stopped at the next conflict ("The rebase stopped again: some
  files conflict"; `CONFLICT` or "could not apply" in git's output is a result, not an error),
  or still going ("The rebase went on").
- **Abort** (or **Stop bisecting**): asks first, naming what goes back and that conflict
  resolutions are lost; `--abort` (`git bisect reset`).
- Errors stay in the bar with git's words.

## Code

- `crates/git-core/src/operation/`: `conflict.rs` (`conflicts`, `take_side`), `mergetool.rs`
  (`run_merge_tool` → `MergeToolOutcome`, `configured_merge_tool`), `rebase.rs` (`rebase` with `RebaseOptions { autostash, rebase_merges }` → `RebaseResult`;
  `rebase_preview` → `RebasePreview { replayed, published }`), `pick.rs` (`pick` with `PickOptions { kind, mainline,
no_commit, record_origin }` → `PickResult`; `CONFLICT`, "could not apply" or "could not
  revert" is `Conflicts`, "is now empty" is skipped and `Empty`, "nothing to commit" is
  `Empty`), `reset.rs` (`reset` with `ResetMode`), `merge.rs` (`merge` → `MergeResult { outcome, output }`;
  exit 1 with `CONFLICT` or "Automatic merge failed" is the `Conflicts` outcome, other failures
  `Rejected`), `state.rs` (`operation_in_progress` from gix `Repository::state()`, plus
  `MERGE_MSG`, `CHERRY_PICK_HEAD`/`REVERT_HEAD` and `rebase-merge/` or `rebase-apply/` for the
  detail and step), `sequence.rs` (`run_step`).
- `src-tauri/src/operations/`: `merge_into_current`, `pick_commit`, `reset_current`, `rebase_current`,
  `get_rebase_preview` (`rebase.rs`), `get_conflicts`, `take_conflict_side`, `open_merge_tool`
  (`conflicts.rs`), `step_operation` (reads the kind itself, so a
  stale UI cannot continue the wrong thing), each under the session's write lock; errors map to
  hints in `error.rs`. The status (`get_status`) carries `operation`, so the bar follows every
  status refresh (watcher, focus, after any change).
- `src/features/operations/`: `MergeDialog`, `PickDialog`, `RebaseDialog` (+ `RebasePreview`),
  `ConflictsDialog`,
  `ResetDialog` (+ `ResetEffects`),
  `OperationBanner`, `OperationDialogs` (mounted in the main window; `openMerge`, `openPick`,
  `openRebase`, `openReset`, `openConflicts`); `useOpenMergeTool` is used by the Commit
  module's file menu. The bar reaches the repository tab through `RepositoryBannerContext`, and
  merge, cherry-pick, revert and reset reach the graph and the Branches module as `RefActions`
  (`merge`, `cherryPick`, `revert`, `rebase`, `reset`), so neither feature depends on this one.

## Not yet

- Rebasing onto one commit while keeping the commits after another (`--onto` with a range); a conflict list with ours/theirs
  and merge tools (slice 4); the three-way merge view (ADR 0014); the interactive rebase editor;
  the reflog.
- Editing the merge message before committing; merge strategies and options (`-X ours`).
- Cherry-picking or reverting several selected commits at once; a commit range.
