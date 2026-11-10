# Reflog

The **Reflog** module (Alt+8, M6 slice 7, 2026-11-10) lists where HEAD, or a local branch,
pointed before each change: every commit, checkout, reset, merge, rebase step, pull and
cherry-pick, newest first. It is how lost work is found again after a hard reset, a rebase or a
deleted branch, and **Restore this state…** puts it back.

## The list

- The header chooses whose reflog: **HEAD (everything you did)** or a local branch that has
  one (`get_reflog` lists them: `HEAD`, then the branches whose log exists, sorted). The choice
  is kept per repository (`store/reflog.ts`).
- Each row: the commit's short id (or "deleted" when the entry deleted the branch), what git did
  (`commit`, `checkout`, `reset`, `rebase (finish)`: the text before the first ": "), the rest
  of its words, and how long ago ("just now" for an entry newer than the clock's last minute
  tick). The tooltip has `HEAD@{n}`, the full id, the whole message, who and when.
- Choosing a row selects its commit in the graph (`goToCommit`). A commit no branch or tag has
  any more says so: "This commit is on no branch or tag: only the reflog still has it". A
  filtered-out commit asks to clear the filter.
- The list is keyed under the repository's references, so it is read again whenever they change
  (the watcher); the chosen row stays on its entry when new ones arrive on top.
- At most 5,000 entries are read, newest first (`MAX_REFLOG_ENTRIES`); "Only the newest 5,000
  entries are shown" says when there are more.

## Actions (the row's context menu)

| Entry                                                       | Does                                                                                                                                                                                          |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Restore this state… (HEAD or the current branch's reflog)   | Opens the reset dialog for the entry's commit, starting on **Keep my changes** (`--keep`): the files follow the branch, uncommitted changes are kept and git refuses when they are in the way |
| Reset the current branch to here… (another branch's reflog) | The same dialog                                                                                                                                                                               |
| Create a branch here…                                       | Gets lost commits back without moving anything                                                                                                                                                |
| Check out this commit…                                      | Detached HEAD, explained in the dialog                                                                                                                                                        |
| Copy commit id                                              | The full id                                                                                                                                                                                   |

The reset dialog is the confirmation: it names the commits that would leave the branch and,
for hard, the files that lose changes ([operations.md](operations.md#reset-dialog)). An entry
that deleted a branch has no menu.

## Code

- `crates/git-core/src/reflog.rs`: `reflog_references`, `reflog` (gix `log_iter().rev()`, read
  from the end of the file, so a long reflog costs only the entries read) → `Reflog { entries,
truncated }`.
- `src-tauri/src/operations/reflog.rs`: `get_reflog`.
- `src/features/reflog/`: `ReflogModule` (+ `ReflogMenu`), `lib/reflog.ts` (words, `HEAD@{n}`,
  selecting the commit), `api/reflog.ts`. The actions come through `RefActionsContext`, like the
  graph's menu; `RefActions.reset` takes `{ restore: true }` to start on Keep.

## Performance

`reflog_spike` (`cargo run --release -p git-core --example reflog_spike -- <repo> [ref]`): a HEAD
reflog padded to 200,000 lines reads its newest 5,000 entries in 2.5 ms; this repository's
(106 entries) in 0.2 ms warm. Listing the references with a reflog: 0.5 ms.

## Not yet

- An undo button for the last operation (planned later, built on the reflog).
- Reflogs of remote-tracking branches and of the stash; a search box; marking which entries'
  commits no branch has (it is said when one is chosen).
