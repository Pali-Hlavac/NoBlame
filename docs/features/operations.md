# Changing history: merge, cherry-pick, revert, reset, rebase and the operation in progress

M6 ([roadmap](../roadmap.md)). **Slice 1 (2026-11-09)**: merging into the current branch, and
the bar above the commits while an operation is in progress (merge, cherry-pick, revert,
rebase, `git am`, bisect) with Continue, Skip and Abort. **Slice 2 (2026-11-09)**: cherry-pick,
revert and reset. **Slice 3 (2026-11-09)**: rebasing the current branch onto a commit, branch or
tag. **Slice 4 (2026-11-09)**: the conflicted files with Use ours, Use theirs, Mark resolved and
the external merge tool. **Slice 5 (2026-11-09)**: the built-in three-way merge view (the
Merge tab, ADR [0014](../adr/0014-conflict-resolution-ui.md)). **Slice 6 (2026-11-10)**: the
interactive rebase editor. The reflog follows in a later slice.

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

## Interactive rebase

**Interactive rebase from here…** on a commit of the current branch opens the editor
(`InteractiveDialog`) with that commit and every commit after it up to HEAD, oldest first
(`get_interactive_plan`: `git log --reverse --topo-order --no-merges <parent>..HEAD`, or `HEAD`
with `--root` for a root commit; at most 500 commits). A commit HEAD does not have is refused
("not on the current branch"). Like the rebase dialog it warns in red when commits were pushed
(on a remote-tracking branch) and says how many merge commits are left out (their commits come
in a line, as `git rebase -i` without `--rebase-merges` does).

| Per commit | Todo line                                                             |
| ---------- | --------------------------------------------------------------------- |
| Pick       | `pick`                                                                |
| Reword     | `pick`, then an `exec` line that amends the message (below)           |
| Edit       | `edit`: the rebase stops after it; amend it, then Continue in the bar |
| Squash     | `squash`; the group gets the combined message, editable               |
| Fixup      | `fixup`                                                               |
| Drop       | `drop`                                                                |

- Rows move with their arrow buttons, or Alt+Up and Alt+Down in their action list. Squash and
  fixup fold a commit into the kept commit above it; the first kept commit cannot be one
  ("there is no commit above it"), and dropping every commit is refused ("Use Reset instead").
- A reworded commit, or one with squashes folded in, gets a box with its new message: its own
  message, then each squashed commit's (a `squash!` or `amend!` subject line is left out, as
  git does). **Arrange fixup! commits** (shown when a subject starts with `fixup! `,
  `squash! ` or `amend! `) moves each under the commit it names (the same subject, an id
  prefix, or a subject that starts with it) as fixup, or squash for `squash!` and `amend!`, as
  `--autosquash` does. **Rebase** is enabled once the list changes anything.
- **Running it** (`rebase_interactive`): the plan is read again under the write lock, and the
  rebase is refused when the commits differ ("The branch changed since the list was made").
  `git_core::operation::todo_script` writes the todo; `rebase_interactive` puts it in a
  temporary file and runs `git rebase --interactive --autostash|--no-autostash <parent>` (or
  `--root`) with `GIT_SEQUENCE_EDITOR` set to a shell function that copies that file over
  git's todo using shell builtins only (no `cp` on git's `PATH` needed), and `GIT_EDITOR=true`.
  A new message is an `exec` line after the commit's group:
  `printf '%s
' '<line>' ... | git commit --amend --quiet --allow-empty -F -`, every line
  single-quoted for `sh`, so `$`, backticks and quotes stay as typed, and no message file is
  needed. The author is kept.
- Outcomes: "Rewrote the commits of topic" (with the force push advice when commits were
  pushed); "The rebase stopped at the commit to edit" (an `edit`; the bar shows the step);
  "The rebase stopped: a step failed" with git's line (an `exec` amend refused by a hook); the
  conflict and stash-conflict toasts of the rebase dialog.

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
| Merge (both sides have it)      | the Merge tab (below)                                                                                 |
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

## The merge view

**Merge** in the list, or **Merge in NoBlame** on a conflicted file in the Commit module, shows
the file in the **Merge** tab (one tab, beside the graph like the diff; `showMergeView`). ADR
[0014](../adr/0014-conflict-resolution-ui.md) has the reasons.

- `get_merge_file` reads the three versions from the index stages with gix, as stored, and
  merges them line by line in Rust (`operation/threeway.rs`): each side is diffed against the
  base (histogram); lines one side changed are taken from it, lines both changed alike once,
  lines both changed differently are a conflict, and changes that touch conflict as in git.
  Conflicts are narrowed like git's default level (shared first and last lines are taken; where
  the base had no lines, the conflict is split where the sides agree). It refuses, with the
  reason, files that are not regular files, binary (a NUL in the first 8000 bytes), not UTF-8,
  over 8 MB, or Git LFS pointers; and says when the file has no conflict (any more), offering
  the next conflicted file.
- The tab shows the merged file: unchanged lines (runs over 7 lines folded to 3 + 3), lines
  changed only by ours (blue bar), only by theirs (orange) or by both alike (green), and each
  conflict with ours and theirs side by side (**Show base** adds the base). A conflict is
  decided with **Use ours**, **Use theirs**, **Ours, then theirs**, **Theirs, then ours** or
  **Edit…** (a text box starting from both); a decision can be edited or undone. **Next
  conflict**, **Use ours / theirs for the rest** and **Start over** are in the header.
  Decisions are UI state (`store/mergeView.ts`), kept per repository and file until saved.
- **Save and mark resolved** (once every conflict is decided) calls `save_merged_file`: the text
  becomes a blob (`git hash-object -w --no-filters --stdin`), replaces the three stages at stage
  0 with our side's mode (`git update-index -z --index-info`), and the working tree file is
  written from the index (`git checkout`), so line-ending settings and filters apply as for any
  checkout. Lines typed in the view get CRLF endings when most of our lines have them as stored.
  It is refused when the file has no conflict any more.
- The file is read again on every status change, so a file resolved elsewhere shows as such.
  Edits made to the working tree file before opening the view are not shown in it; saving
  replaces the file.

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

- `crates/git-core/src/operation/`: `conflict.rs` (`conflicts`, `take_side`), `threeway.rs`
  (`merge_chunks` → `MergeChunk`), `merge_file.rs` (`merge_file` → `MergeFile` or
  `Unmergeable`, `save_merged`), `mergetool.rs`
  (`run_merge_tool` → `MergeToolOutcome`, `configured_merge_tool`), `rebase.rs` (`rebase` with `RebaseOptions { autostash, rebase_merges }` → `RebaseResult`;
  `rebase_preview` → `RebasePreview { replayed, published }`), `interactive.rs`
  (`interactive_plan` → `InteractivePlan`, `rebase_interactive`), `todo.rs` (`todo_script` from
  `TodoStep`s), `pick.rs` (`pick` with `PickOptions { kind, mainline,
no_commit, record_origin }` → `PickResult`; `CONFLICT`, "could not apply" or "could not
  revert" is `Conflicts`, "is now empty" is skipped and `Empty`, "nothing to commit" is
  `Empty`), `reset.rs` (`reset` with `ResetMode`), `merge.rs` (`merge` → `MergeResult { outcome, output }`;
  exit 1 with `CONFLICT` or "Automatic merge failed" is the `Conflicts` outcome, other failures
  `Rejected`), `state.rs` (`operation_in_progress` from gix `Repository::state()`, plus
  `MERGE_MSG`, `CHERRY_PICK_HEAD`/`REVERT_HEAD` and `rebase-merge/` or `rebase-apply/` for the
  detail and step), `sequence.rs` (`run_step`).
- `src-tauri/src/operations/`: `merge_into_current`, `pick_commit`, `reset_current`, `rebase_current`,
  `get_rebase_preview` (`rebase.rs`), `get_conflicts`, `take_conflict_side`, `open_merge_tool`
  (`conflicts.rs`), `get_merge_file`, `save_merged_file` (`merge_view.rs`),
  `get_interactive_plan`, `rebase_interactive` (`interactive.rs`), `step_operation`
  (reads the kind itself, so a
  stale UI cannot continue the wrong thing), each under the session's write lock; errors map to
  hints in `error.rs`. The status (`get_status`) carries `operation`, so the bar follows every
  status refresh (watcher, focus, after any change).
- `src/features/operations/`: `MergeDialog`, `PickDialog`, `RebaseDialog` (+ `RebasePreview`),
  `ConflictsDialog`, `MergeView` (the Merge tab: `MergeHeader`, `ConflictChunk`, `ResolvedChunk`,
  `MergeText`, `MergeUnavailable`), `InteractiveDialog` (+ `TodoList`; `lib/todo.ts` holds
  the groups, messages, autosquash and the request),
  `ResetDialog` (+ `ResetEffects`),
  `OperationBanner`, `OperationDialogs` (mounted in the main window; `openMerge`, `openPick`,
  `openRebase`, `openReset`, `openInteractive`, `openConflicts`); `useOpenMergeTool` and `showMergeView` are used
  by the Commit module's file menu. The bar reaches the repository tab through `RepositoryBannerContext`, and
  merge, cherry-pick, revert and reset reach the graph and the Branches module as `RefActions`
  (`merge`, `cherryPick`, `revert`, `rebase`, `interactiveRebase`, `reset`), so neither feature
  depends on this one.

## Not yet

- Rebasing onto one commit while keeping the commits after another (`--onto` with a range); the
  reflog.
- In the interactive rebase: dragging rows with the mouse, `exec` lines of one's own, keeping
  merge commits (`--rebase-merges` with labels), and reordering several selected rows at once.
- In the merge view: editing the lines git merged by itself, word-level highlights, syntax
  colours, and custom `merge` drivers from `.gitattributes` (the view uses its own merge).
- Editing the merge message before committing; merge strategies and options (`-X ours`).
- Cherry-picking or reverting several selected commits at once; a commit range.
