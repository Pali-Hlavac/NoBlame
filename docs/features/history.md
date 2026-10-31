# File history

The **history tab** lists the commits that change one file or folder, newest first, following a
file's renames. Status: M3 slice 8 (2026-10-31), ADR [0022](../adr/0022-file-history-and-blame.md).

## Behaviour

- **Opening**: right-click a file or folder in Files and choose **File history** (**Folder
  history**), or click **History** in the file tab. The tab opens beside the repository tab,
  not in the group of the diff and file tabs, so the diff stays visible next to it. There is
  one history tab; choosing another path switches it in place.
- **Rows**: what the commit did to the path (**A**dded, **M**odified, **D**eleted, **R**enamed,
  or a merge icon), the short id, the summary, the file's other name in that commit (`← old` for
  the rename itself, `as old` before it), the author and the date.
- **Header**: the file's name and folder, the number of commits, and the names the file had
  before. If renames could not be followed to the end, a line says where and why.
- **Moving onto a commit** (click, arrows, Enter) selects it in the graph. For a file, Changed
  files chooses the file under the name it had in that commit, and the diff tab shows that
  change. For a folder, only the commit is selected.
- The cursor follows the commit selected elsewhere (the graph, Commit details) when that commit
  is in the history.
- **Branches**: the history covers the branches the graph's filter shows (all branches by
  default), and first parents only when that filter is on. The header says so when the filter
  narrows it. Author, message and path filters do not narrow the history, but commits they hide
  are drawn dimmed and cannot be selected.
- **Following renames**: where a commit added the file, or a merge brought it from a branch
  where it had another name, the history continues under the old name on that side. Each
  branch keeps its own name, unlike `git log --follow`. Folders are not followed.
- **Partial clones**: following a rename may need old file contents that the clone does not
  have. The history then stops there and says so; NoBlame downloads nothing.
- **Reloads**: after a change outside the app, or a filter change, the history is read again
  and the rows point at the new graph.

## How it works

- `git_core::history::file_history`:
  - runs `git log --stdin --format=%x01%H -z --name-status --no-renames -- :(literal)<path>`
    for each name of the file, with the tips on standard input;
  - checks commits that added the path, and merges, with gix rename detection against each
    parent that lacks it (`rename_sources`);
  - walks old names from those parents, batching walks of the same name, at most 64 renames
    (`MAX_RENAMES`).
- The session (`repository/sessions/history.rs`) keeps one history (`PathHistory`).
  - It is read for the full graph's tips that the filter chooses, and sorted in the graph's
    order (`Graph::lookup_row`, a binary search in the commit index).
  - It is kept until the history is reloaded, the branch or first-parent filter changes, or
    another path is asked for.
  - Asking for another path cancels a history still being read.
- Commands: `get_file_history` (count, earlier names, why it stopped) and
  `get_file_history_rows` (pages of up to 500 commits with summary, author and row; see
  [ipc.md](../architecture/ipc.md)).
- Frontend: `src/features/history/`.
  - The queries live under the graph's keys, so a reload or a filter change refetches them.
    Pages also carry the graph generation.
  - `VirtualList` reports the rows it renders (`onRangeChange`), and the list fetches the pages
    of 200 commits around them.

## Performance

See ADR 0022 for the comparison with `git log --follow`. Measured with `history_spike`
(release, 2026-10-31):

| Repository                    | Path                  | Commits | Names | Time   |
| ----------------------------- | --------------------- | ------- | ----- | ------ |
| git.git (82k commits)         | `builtin/log.c`       | 863     | 2     | 1.3 s  |
| git.git                       | `diff.c`              | 1,702   | 1     | 0.72 s |
| Linux kernel (1.5M, blobless) | `MAINTAINERS`         | 22,019  | 1     | 9.2 s  |
| Linux kernel                  | `kernel/sched/core.c` | 1,992   | 1     | 1.7 s  |

The kernel clone's commit-graph file has no changed-path Bloom filters; `git log -- <path>` is
almost all of the time.

## Not yet

- Showing commits while the history is still being read (the first page waits for all of it).
- Reading only the new commits after a reload.
- Copies (`-C`), and following a folder's renames.
- A history in its own window (`noblame filehistory <path>`, M8).
