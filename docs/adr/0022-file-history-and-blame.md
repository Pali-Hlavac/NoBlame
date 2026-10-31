# 0022: File history and blame: git for the walks, gix for renames

- Status: Accepted
- Date: 2026-10-31
- Milestone: M3 (slice 8)

## Context and problem

M3 needs two views of one file:

- **File history**: the commits that change a file, following renames;
- **Blame**: for each line, the commit that last changed it, and "blame the previous revision"
  to look past that change.

Both must stay usable on huge repositories:

- the Linux kernel (1.5M commits; the benchmark clone is blobless and has no Bloom filters);
- git.git (82,634 commits, full contents), cloned into `.cache/repos/git` for these numbers.

ADR [0007](0007-git-engine.md) planned both with gix ("reads with gix"), so the choice had to be
measured.

## Decision drivers

- Speed on long histories and on large files.
- git's semantics where users know them: history simplification, `blame.ignoreRevsFile`,
  `.mailmap`, rename following.
- Correct results in non-linear history: a file renamed on one branch and edited under its old
  name on another.
- Partial clones: no silent downloads, and a clear message when contents are missing.

## Considered options

History:

1. `git log --follow -- <path>`, as Git Extensions does.
2. `git log -- <path>` for each name, and gix rename detection where the file appears.
3. A walk in-process with gix (tree lookups per commit, on threads).

Blame:

1. `git blame --incremental` (the user's git).
2. gix-blame (`gix::Repository::blame_file`, the `blame` feature of gix 0.90).

## Decision outcome

### History: option 2

`git_core::history::file_history`:

- `git log --name-status --no-renames -- :(literal)<path>` lists the commits that change the
  path, with git's default history simplification and its changed-path Bloom filters. The tips
  go on standard input, as for the path filter (ADR [0021](0021-graph-filters.md)).
- Where a commit added the file, gix diffs it against its parent with rename detection always on
  (whatever `diff.renames` says) and finds the old name.
- A merge is checked too, against every parent that does not have the path. That finds the
  side branch where the file still had its old name.
- Each old name is walked from those parents. Walks of one name are batched, so topic branches
  merged after a rename cost one `git log`. At most 64 renames are followed.
- Folders are listed but not followed.
- In a partial clone, inexact rename detection needs contents that are not there. The history
  then stops at that commit and says so; nothing is downloaded.

The session sorts the commits by the graph's order, keeps the history while the tab shows it,
and serves it in pages with the row of each commit in the graph shown.

### Blame: option 1

`git blame --incremental` is 1.4–2 times faster than gix-blame on git.git (below). It is also
the blame users know: it reads `blame.ignoreRevsFile`, applies `.mailmap`, follows renames and
can detect moved lines. gix-blame 0.20 does none of the last three. The `previous` lines of its
output name the parent and path for "blame the previous revision".

### Measurements (2026-10-31, release builds, warm disk cache)

History of a file in git.git (no commit-graph file):

| File                        | `git log -- <path>` | `git log --follow` | NoBlame (following renames)              |
| --------------------------- | ------------------- | ------------------ | ---------------------------------------- |
| `builtin/log.c`             | 0.56 s, 638 commits | 8.4 s, 589 commits | 1.3 s, 863 commits (was `builtin-log.c`) |
| `diff.c`                    | 0.67 s, 1,702       | 2.7 s, 1,199       | 0.72 s, 1,702                            |
| `Documentation/git-log.txt` | 0.50 s, 135         | 2.3 s, 116         | 0.55 s, 136 (was `git-log-script.txt`)   |

`--follow` misses commits: it switches to the old name for the whole walk, and it handles
merges differently. On the Linux kernel, `MAINTAINERS` (22,019 commits, no Bloom filters) takes
9.2 s; `kernel/sched/core.c` takes 1.7 s and stops at the move into `kernel/sched/`, whose
contents the blobless clone lacks.

Blame of the newest version in git.git:

| File            | Lines | `git blame --incremental` | gix-blame |
| --------------- | ----- | ------------------------- | --------- |
| `builtin/log.c` | 2,858 | 0.61 s                    | 0.93 s    |
| `diff.c`        | 7,860 | 1.07 s                    | 2.09 s    |
| `sequencer.c`   | 7,091 | 0.93 s                    | 1.32 s    |

### Consequences

Good:

- History: as fast as `git log -- <path>` plus a few milliseconds per rename, and more complete
  than `--follow`.
- Blame: git's speed and its configuration, with no new dependency.

Bad:

- Both run the user's git per request. On a huge history without Bloom filters the first page
  of a history takes seconds (9 s for the kernel's `MAINTAINERS`); writing the commit-graph
  file with changed paths (the commit-graph offer) is the remedy.
- History is read again after every reload of the graph (a commit, a fetch); it is not
  incremental yet.
- gix rename detection uses its defaults (50 % similarity, no copies), which can differ from
  a user's `diff.renameLimit` on huge commits.

## Pros and cons of the options

### History 1: `git log --follow`

- Good: one process; git's own rename following.
- Bad: 4–15 times slower here, and fewer commits (a single name for the whole walk). Only one
  file, no folders. In a partial clone it fetches contents to detect renames.

### History 3: in-process walk with gix

- Good: no process; could run on threads.
- Bad: git's history simplification would have to be reimplemented exactly. git already uses
  the Bloom filters of the commit-graph file, which gix does not read.

### Blame 2: gix-blame

- Good: in-process; no output to parse.
- Bad: slower, and without `blame.ignoreRevsFile`, moved-line detection or `.mailmap`.

## Links

- [features/history.md](../features/history.md), [features/blame.md](../features/blame.md)
- [architecture/git-engine.md](../architecture/git-engine.md)
- ADR [0007](0007-git-engine.md) (gix for reads, the CLI for writes), [0021](0021-graph-filters.md)
  (path filter)
