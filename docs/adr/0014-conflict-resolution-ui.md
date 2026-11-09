# 0014: Conflict resolution: a list, whole sides, the merge tool, and a built-in merge view

- Status: Accepted
- Date: 2026-11-09
- Milestone: M6 (slices 4 and 5)

## Context and problem

A merge, cherry-pick, revert or rebase that stops on conflicts leaves each conflicted file in
the index as up to three stages (1 base, 2 ours, 3 theirs) and writes the file into the working
tree with conflict markers. The user has to decide every conflicting region and stage the file
before **Continue**.

Git Extensions and TortoiseGit offer a list of the conflicted files, "take mine / take theirs"
for whole files, and an external merge tool (KDiff3 by default). Many users have no merge tool
installed, and the owner asked for conflicts to be resolvable inside the app. The question is
how NoBlame resolves conflicts: which pieces, where the three-way merge is computed, and how the
result gets back into the repository so that line endings, filters and file modes stay right.

## Decision drivers

- Correct results: what is saved must be exactly what git would have stored (line endings,
  `core.autocrlf`, `.gitattributes` filters, the executable bit).
- Behaviour close to git's own merge, so the conflicts shown are the ones git reported.
- Works without any external tool; the user's merge tool still works for those who have one.
- Only Rust touches the repository (ADR [0002](0002-rust-owns-git-access.md)); writes run the
  user's `git` (ADR [0007](0007-git-engine.md)).
- Plain UI: who "ours" and "theirs" are must be said in words (they swap during a rebase).

## Considered options

1. **Parse the conflict markers** git wrote into the working tree file, and save the edited file
   with `git add`.
2. **Run `git merge-file -p --diff3`** on the three versions (written to temporary files) and
   parse its markers.
3. **Read the three stages with gix and merge them in Rust** (diff3 on top of imara-diff, the
   line diff the diff viewer uses), and save through the index: `git hash-object -w
--no-filters`, `git update-index --index-info`, `git checkout`.

## Decision outcome

Chosen: **option 3** for the merge view, beside a conflict list with whole-side actions and the
external merge tool (slice 4).

**The list** (`get_conflicts`, `git ls-files -u -z`) gives each file's kind from its stages and
offers **Merge** (the built-in view), **Merge tool** (`git mergetool --no-prompt --tool=<tool>`),
**Use ours / Use theirs** (`git checkout --ours|--theirs` and `git add`, or `git rm` where that
side deleted the file) and **Mark resolved** (`git add`).

**The merge view** (`git_core::operation::threeway`, `merge_file`):

- The base, ours and theirs come from the index stages (gix), as stored: before line-ending
  conversion or smudge filters. Files that are not regular files, contain a NUL byte in their
  first 8000 bytes (git's binary test), are not UTF-8, are over 8 MB or are Git LFS pointers are
  not merged in the view; it says why and points to the other ways.
- Ours and theirs are each diffed against the base (histogram, with the slider heuristics of the
  diff viewer). The base is walked in order: lines only one side changed are taken from it,
  lines both changed alike are taken once, and lines both changed differently are a conflict.
  As in git, changes that touch (one ends where the other starts) conflict too.
- Conflicts are narrowed as git's default ("zealous") level does: leading and trailing lines
  that ours and theirs share are taken as resolved. Where the base had no lines (both sides
  added lines at one place, or a file added on both sides), the conflict is split wherever the
  two sides agree.
- The UI (the **Merge** tab, `features/operations`) shows each conflict with ours and theirs
  side by side (the base on request) and decides it with **Use ours**, **Use theirs**, **Ours,
  then theirs**, **Theirs, then ours** or an edit. Resolved lines are marked by who changed them.
  Decisions are UI state (Zustand) until the file is saved.
- **Saving** (`save_merged_file`) writes the merged text as a blob without filters
  (`git hash-object -w --no-filters --stdin`), replaces the three stages with it at stage 0 and
  our side's mode (`git update-index -z --index-info`), and writes the working tree file from the
  index (`git checkout -- <path>`), so `core.autocrlf`, `eol` and smudge filters apply exactly
  as for any checkout. Lines typed in the view get CRLF endings when most of our lines have them
  as stored.

### Consequences

Good:

- No markers are parsed: a file that contains `<<<<<<<` itself, or a user's `merge.conflictStyle`,
  cannot confuse the view.
- What is saved is what git would store; the working tree file matches the checkout settings.
- Works offline and without a merge tool; the merge is in-process (milliseconds for ordinary
  files), and the result is checked by tests against the real `git`.

Bad:

- The merge is NoBlame's own, not git's: in rare cases (another diff algorithm, rename-aware
  content merges, custom `merge` drivers in `.gitattributes`, rerere) its conflicts can differ
  from the markers git wrote. The view always starts from the stages, so it never loses data;
  the merge tool and editing the file remain available.
- Edits made to the working tree file before opening the view are not shown in it; saving
  replaces the file.
- Non-UTF-8 and very large files must be resolved another way.

## Pros and cons of the options

### Option 1: parse the markers

- Good: shows exactly what git wrote, including custom merge drivers and rerere.
- Bad: depends on `merge.conflictStyle` and marker size (`conflict-marker-size`); a file whose
  content looks like markers breaks it; the working tree file has already been through
  line-ending conversion, so saving round-trips through the user's filters.

### Option 2: `git merge-file`

- Good: git's own merge algorithm.
- Bad: needs temporary files of repository content; still parses markers; `--object-id` (no
  temporary files) needs git 2.43, above our minimum (2.39).

### Option 3: stages and a merge in Rust (chosen)

- Good: exact bytes in and out, no markers, no temporary files, testable.
- Bad: an own diff3 to keep close to git's behaviour.

## Links

- [features/operations.md](../features/operations.md#resolving-conflicts), the user guide
  [merging.md](../user-guide/merging.md#when-files-conflict)
- ADR [0013](0013-diff-viewer.md) (the line diff used here)
- git: `git-merge-file(1)`, `git-update-index(1)` (`--index-info`), `gitattributes(5)`
