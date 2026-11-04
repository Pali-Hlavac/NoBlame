# 0023: Comparing two revisions: `git diff --raw`, gix in partial clones

- Status: Accepted
- Date: 2026-11-02
- Milestone: M3 (slice 9)

## Context and problem

The compare tab lists the files that differ between any two revisions (two branches, a tag and
HEAD, two commits), directly or since the point where they split (their merge base). Two
revisions far apart differ in many files, with many renames among them:

- git.git, v2.40.0 to v2.50.0: 3,197 files, 851 of them renamed;
- the Linux kernel, v4.0 to HEAD: 116,665 files.

The Changed files module lists one commit's files with a gix tree diff, as ADR
[0007](0007-git-engine.md) planned ("reads with gix"). So the same code was measured first.

## Decision drivers

- Speed of the file list for revisions far apart, where rename detection does most of the work.
- The user's rename settings (`diff.renames`, `diff.renameLimit`), as in Changed files.
- Partial clones: never download, and never hang.

## Considered options

1. gix `diff_tree_to_tree` with rename detection, as Changed files does.
2. `git diff --raw -z --no-abbrev <from> <to>`, the user's git, read-only.
3. Option 2, with gix for partial clones.

## Decision outcome

Option 3, in `git_core::compare`:

- **The file list:** `git diff --raw -z --no-abbrev --no-ext-diff <from> <to> --` is run, and
  its entries are parsed (`compare/raw.rs`).
  - Each entry has both blob ids, so the diff of a file works exactly as in Changed files.
  - It runs with `GIT_NO_LAZY_FETCH=1` and the usual safe environment (`GitCommand`).
- **Partial clones:** a remote marked `promisor`, or `extensions.partialClone`, means a partial
  clone. Its comparison uses gix instead. When rename detection needs contents that are missing,
  it runs again with exact renames only (`diff/changes.rs`, `tree_changes`). An edited, moved
  file is then shown as deleted and added, and the tab says why.
- **The merge base:** gix (`Repository::merge_base`, which uses the commit-graph file).
- **Commits each side lacks:** `git rev-list --left-right --count <base>...<target>`.
- **Revisions:** typed text is resolved in-process by `graph::resolve_commit` (the one "Go to
  commit" uses), so nothing typed reaches a command line. Only full commit ids are passed to
  git.
- **Limits:** at most 100,000 files are returned. The commands are `get_comparison` and
  `count_ahead_behind`.

### Measurements (2026-11-02, release build, warm disk cache)

`compare_spike` (`cargo run --release -p git-core --example compare_spike -- <repo> <a> <b>`):

| Repository       | Revisions         | Files   | gix tree diff                  | `git diff --raw` (chosen) | Since the merge base | Ahead/behind |
| ---------------- | ----------------- | ------- | ------------------------------ | ------------------------- | -------------------- | ------------ |
| git.git          | v2.40.0 → v2.50.0 | 3,197   | 4.0 s                          | 0.21 s                    | 0.21 s               | 0.03 s       |
| git.git          | v1.0.0 → HEAD     | 5,131   | not run                        | 0.04 s                    | 0.07 s               | 0.06 s       |
| Linux (blobless) | v7.2 → v7.3       | 14,901  | 0.23 s (exact renames, chosen) | 70 s, then fails          | 0.19 s               | 0.08 s       |
| Linux (blobless) | v6.0 → v7.3       | 84,842  | 0.20 s (chosen)                | fails                     | 0.39 s               | 0.32 s       |
| Linux (blobless) | v4.0 → HEAD       | 116,665 | 0.24 s (chosen)                | not run                   | 0.83 s               | 0.73 s       |

git's rename detection is about 20 times faster than gix's on git.git. git pairs exact renames
first, and then files with the same base name, before comparing contents. In the blobless Linux
clone, `git diff` with rename detection spent 70 s and then failed, even with lazy fetching
off.

### Later: the working tree (M4 slice 6, 2026-11-04)

A revision compared with the working tree runs `git diff --raw -z --no-abbrev <from> --`, the
same parser, in the working tree; in a partial clone with `-M100%`, so only exact renames are
looked for and no old contents are read. The new side of each file is the file on disk: git gives
the index's id, none, or the hash of contents it never stored (when it hashed files to look for
renames), so those ids are dropped and the file is read. On git.git with its 4,857 files checked
out, `v2.40.0` → working tree takes 0.49 s.

### Consequences

Good:

- Well under a second for every comparison measured, up to 116,665 files.
- Renames follow the user's git config, as in a terminal.

Bad:

- Changed files and the compare tab use different engines. They list the same files (both
  follow `diff.renames`), but rename pairing can differ on huge commits, as between gix and git
  in general.
- In a partial clone, an edited file that was also moved is shown as deleted and added.
- One `git` process per comparison. Comparing the same revisions again costs nothing (the UI
  caches by revision until the graph reloads).

## Pros and cons of the options

### Option 1: gix tree diff with rename detection

- Good: no process; one engine for Changed files and the compare tab.
- Bad: 4 s on git.git v2.40.0 → v2.50.0, against git's 0.21 s.

### Option 2: always `git diff --raw`

- Good: one code path.
- Bad: partial clones take a minute and then fail.

## Links

- [features/compare.md](../features/compare.md)
- [architecture/git-engine.md](../architecture/git-engine.md)
- ADR [0007](0007-git-engine.md) (gix for reads, the CLI for writes) and
  [0022](0022-file-history-and-blame.md) (git where it is faster: history and blame)
