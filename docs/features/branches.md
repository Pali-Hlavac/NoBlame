# Branches and tags

Status: **M5 slice 1 done (2026-11-06)**: check out a branch, a commit or a remote branch;
create, rename and delete branches; create and delete tags. Upstreams and ahead/behind are
slice 2; pushing and deleting on a remote are slice 5 ([roadmap](../roadmap.md#m5-branches-tags-and-remotes)).

The Branches module itself (sections, filter, sort) is described in
[workbench.md](workbench.md#modules).

## Where the actions are

- **The commit menu** in the graph (right click, Shift+F10, Menu key): **Check out this
  commit…**, **Create a branch here…**, **Create a tag here…**, and in each branch or tag
  submenu **Check out**, **Rename…**, **Delete…** (branches), **Check out as a new local
  branch…** (remote branches), **Delete…** (tags). Push, Merge and Rebase stay labelled stubs
  (M5 slice 5, M6).
- **The Branches module**: right click a row (or Shift+F10 / Menu key on the active row):

  | Row           | Entries                                                                                                                   |
  | ------------- | ------------------------------------------------------------------------------------------------------------------------- |
  | Local branch  | Check out (not the current one), Create a branch here, Create a tag here, Rename, Delete (not the current one), Copy name |
  | Remote branch | Check out as a new local branch, Create a branch here, Create a tag here, Copy name                                       |
  | Tag           | Create a branch here, Delete, Copy name                                                                                   |

  **F2** renames the active branch, **Delete** deletes the active branch or tag (both open
  their dialog). A click still selects the commit.

## Behaviour

- **Check out a branch** runs at once: `git switch --no-guess <name>` (never creates a branch
  from a remote one of the same name). A toast says "Checking out …", then "Switched to …".
  When git refuses (local changes would be overwritten), the toast shows git's words, line by
  line, and a hint to commit or stash first. Nothing is stashed or merged automatically.
- **Check out a commit** asks first and explains a detached HEAD (commits made there belong to
  no branch); the dialog offers **Create a branch here instead…**. Runs `git switch --detach`.
- **Check out a remote branch** opens the create dialog with the name without the remote
  (`origin/feature/x` → `feature/x`), checked at once against existing branches. It runs
  `git switch --track --create=<name> refs/remotes/<remote>/<branch>`, so the new branch tracks
  it whatever `branch.autoSetupMerge` says.
- **Create a branch**: a name and **Check out the new branch** (on by default). From a commit
  it starts at the commit id; from the Branches module at the full reference name
  (`refs/remotes/origin/x`), so git's `branch.autoSetupMerge` decides tracking as usual. Runs
  `git switch --create=<name> <start>` or `git branch <name> <start>`.
- **Rename**: `git branch --move`; the reflog, upstream and `branch.<name>.*` settings move
  along. A pushed copy keeps its old name on the remote (the dialog says so).
- **Delete** always asks. Before the dialog shows its button, NoBlame counts the commits only
  that branch or tag holds (`get_unique_commits`: `git rev-list --count <tip> --not
--exclude=<name> --branches --tags --remotes HEAD`) and names them: "4 commits are on no
  other branch or tag", the newest three by id and subject, "and 1 older commit", and that a
  new branch at the newest id brings them back while git keeps them. With none: "only the name
  goes". Tags add that a pushed copy stays on the remote. Then `git branch --delete --force` or
  `git tag --delete`. The current branch has no Delete entry (git refuses it anyway).
- **Create a tag**: a name and an optional message. With a message the tag is annotated
  (`git tag --annotate --file=-`, the message on standard input, so any text is safe) and git
  signs it when `tag.gpgSign` is set; without, it is lightweight.
- **Rename and delete check first** that the branch or tag still points at the commit the user
  saw (`check_ref`, annotated tags peeled). One moved in a terminal meanwhile is not touched:
  "… changed since it was shown, so nothing was done."
- **Names are checked as they are typed** (`lib/names.ts`, git's `check-ref-format` rules: no
  spaces, `..`, `~^:?*[\`, `@{`, control characters, leading `-` or `.`, `.lock` ends, empty
  parts), against existing branches or tags, and against names that would clash as a file and
  a folder (`topic` and `topic/old`). The backend checks again (`validate_name`, gix's
  reference name validation), and git has the last word: its message shows in the dialog.
- All changes hold the session's write lock. The file watcher reports the changed refs, which
  reloads the graph, the Branches module and the title bar's branch.

## Code

- `crates/git-core/src/branch/`: `write.rs` (switch, create, rename, delete), `tag.rs`,
  `unique.rs` (the commits only one reference holds), `mod.rs` (`validate_name`, `check_ref`,
  `head_commit`, `BranchError`). Tests: `tests/branch_write.rs`.
- `src-tauri/src/branches/`: commands `checkout_branch`, `checkout_commit`, `create_branch`,
  `rename_branch`, `get_unique_commits`, `delete_ref`, `create_tag`; errors in
  `repository/branch_error.rs`.
- `src/features/branches/`: `api/branches.ts`, `hooks/useRefActions.ts` (the actions),
  `store/dialog.ts` (the dialog asked for), `components/BranchDialogs.tsx` (mounted once in the
  main window) and one component per dialog, `lib/menu.ts` (the module's menu).
- The graph does not depend on the branches feature: it declares `RefActions` and
  `RefActionsContext` (`features/graph/lib/refActions.ts`); `MainWindow` provides
  `useRefActions`. Without a provider (task windows) the entries stay labelled stubs.

## Performance

Counting the commits only a reference holds is one `git rev-list --count` (and a `git log
-n 3` when there are any): 0.1–0.4 s on the Linux kernel (957 refs) and synthetic-1m (10,570
refs), 0.8 s at worst (the oldest tag of Linux). The dialog says "Counting…" meanwhile. See
[performance.md](../development/performance.md#branch-and-tag-actions-m5-slice-1-2026-11-06).
