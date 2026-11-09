# Changing history: merge and the operation in progress

M6 ([roadmap](../roadmap.md)). **Slice 1 (2026-11-09)**: merging into the current branch, and
the bar above the commits while an operation is in progress (merge, cherry-pick, revert,
rebase, `git am`, bisect) with Continue, Skip and Abort. Cherry-pick, revert, reset, rebase,
conflict resolution, the interactive rebase editor and the reflog follow in later slices.

## Where

- **Merge into the current branch…** in the commit context menu (the commit), in the submenu of
  each branch, remote branch and tag on a commit, and in the Branches module's menu (local
  branches other than the current one, remote branches, tags).
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

- `crates/git-core/src/operation/`: `merge.rs` (`merge` → `MergeResult { outcome, output }`;
  exit 1 with `CONFLICT` or "Automatic merge failed" is the `Conflicts` outcome, other failures
  `Rejected`), `state.rs` (`operation_in_progress` from gix `Repository::state()`, plus
  `MERGE_MSG`, `CHERRY_PICK_HEAD`/`REVERT_HEAD` and `rebase-merge/` or `rebase-apply/` for the
  detail and step), `sequence.rs` (`run_step`).
- `src-tauri/src/operations/`: `merge_into_current`, `step_operation` (reads the kind itself, so a
  stale UI cannot continue the wrong thing), each under the session's write lock; errors map to
  hints in `error.rs`. The status (`get_status`) carries `operation`, so the bar follows every
  status refresh (watcher, focus, after any change).
- `src/features/operations/`: `MergeDialog`, `OperationBanner`, `OperationDialogs` (mounted in
  the main window). The bar reaches the repository tab through `RepositoryBannerContext`, and
  merge reaches the graph and the Branches module as `RefActions.merge`, so neither feature
  depends on this one.

## Not yet

- Cherry-pick, revert, reset (slice 2); rebase onto (slice 3); a conflict list with ours/theirs
  and merge tools (slice 4); the three-way merge view (ADR 0014); the interactive rebase editor;
  the reflog.
- Editing the merge message before committing; merge strategies and options (`-X ours`).
