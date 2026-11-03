# Commit module and dialog

Staging files and committing them (M4 slice 2). User guide:
[committing.md](../user-guide/committing.md).

## Where it opens

The toolbar's **Commit** button, the palette's **Commit…** and the **Commit…** entry of a
repository's **…** menu open the commit window where `commit.openIn` says
(Settings → Committing):

| Setting            | Opens                                                                                                                                                                                         |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `module` (default) | The **Commit** module (`commit`, Alt+7) in the left dock; choosing a file shows the diff tab                                                                                                  |
| `dialog`           | `CommitDialog`, a modal dialog (85 % of the window) with the lists and message on the left and the chosen file's diff (`WorkingTreeDiff`) on the right; it closes after a commit with a toast |

From a repository's **…** menu, the repository's tab is shown first (or the repository opened),
since both work on the active repository. `openCommit(placement)` in
`src/app/workbench/commit.ts` decides; the toolbar and the repository actions are built by hooks
(`useToolbarActions`, `useRepositoryActions`) so they read the setting.

## Content (`CommitPanel`)

- **Changes** (changed, untracked, conflicted) above **Staged**, each a virtualized
  `StagingList` with its count and **Stage all** / **Unstage all**. Rows reuse `ChangedFileRow`;
  a **+** / **−** button shows on hover and on the active row; **Space** moves the active row,
  Enter or a click chooses it.
- Choosing a file selects the matching working tree row (`select(repoPath, { kind })`) and the
  file (`selectFile`), so the graph, Changed files and the diff tab agree with the module.
- When the chosen file moves to the other list, the next file of its list is chosen (or the one
  before); when it was the last, the choice follows it into the other list.
- Staging a conflicted file, or **Stage all** while conflicts exist, asks first: staging marks a
  conflict resolved.
- While git runs, the buttons are disabled and the list being emptied says **Staging…** or
  **Unstaging…** (on 40,000 changed files `git add` takes about 13 s).
- The message box (Ctrl/⌘+Enter commits), **Amend last commit**, **Sign off**, the Commit
  button (labelled **Amend** when amending) and why it is disabled.
- Ticking Amend with an empty box fills in the last commit's message (`get_head_message`);
  unticking takes it away again unless it was edited.
- The draft (message, Amend, Sign off) lives in a Zustand store keyed by repository path, kept
  while the app runs; a commit clears the message and Amend and keeps Sign off.
- Git's output is shown under the button: the summary line after a commit, or everything git
  and its hooks printed when it refused (the commit error is rendered inline, not as a toast).

## Backend

| Command             | Runs                                                                               |
| ------------------- | ---------------------------------------------------------------------------------- |
| `stage_files`       | `git --literal-pathspecs add --all --pathspec-from-file=- --pathspec-file-nul`     |
| `stage_all_files`   | `git add --all`                                                                    |
| `unstage_files`     | `git --literal-pathspecs reset --quiet --pathspec-from-file=- --pathspec-file-nul` |
| `unstage_all_files` | `git reset --quiet -- .` (limited to paths, so a merge in progress is kept)        |
| `create_commit`     | `git commit --file=- [--amend] [--signoff]`, the message on standard input         |
| `get_head_message`  | gix: HEAD's commit message (`null` on an unborn branch)                            |

- Paths go on standard input, NUL-separated and literal: no command-line length limit, and a
  file named `[ab].txt` is not a pattern. A rename is unstaged by both its names.
- A display path containing U+FFFD came from a name that is not UTF-8 and is refused
  (`LossyPath`); Stage all still works for such files.
- Every change holds the session's write lock (`Session::lock_writes`), so two never race for
  `index.lock`.
- `git commit` runs with the user's config: identity, `commit.gpgSign`, `commit.cleanup`
  (default `whitespace` with `--file`, so `#` lines are kept), hooks. A refusal becomes
  `CommitError::Rejected { output }` (stdout and stderr), shown as the error's message.
- The status is invalidated after each change; the graph follows through the file watcher, which
  sees HEAD move (whoever was on HEAD follows it to the new commit).

## Not yet

- Hunks and single lines, discarding changes (slice 3); recent messages, `commit.template`,
  author override and summary length hints (slice 4).
- Choosing several files at once (Shift/Ctrl+click).
- The `noblame commit <path>` task window is still the M8 placeholder.
