# Commit module

Staging files and committing them (M4 slices 2–4). User guide:
[committing.md](../user-guide/committing.md).

## Where it opens

The toolbar's **Commit** button, the palette's **Commit…** and the **Commit…** entry of a
repository's **…** menu open the **Commit** module (`commit`, Alt+7) with `openCommit()` in
`src/app/workbench/commit.ts`:

| Where                  | Shows                                                                                                                                                                                                        |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Docked (default)       | The lists and the message (`CommitPanel`); choosing a file shows the diff tab                                                                                                                                |
| Popped out (its popup) | `CommitBeside`: the lists and message on the left, the chosen file's diff (`WorkingTreeDiff`) on the right, under a line naming the branch and the repository; the popup closes after a commit, with a toast |

The module asks `useModuleHost()` where it is ([workbench.md](workbench.md#popping-a-module-out)).
Popping it out replaced the earlier setting (Settings → Committing, module or dialog,
2026-11-03): the popup is that dialog, chosen from the tab's menu instead.

From a repository's **…** menu, the repository's tab is shown first (or the repository opened),
since both work on the active repository.

In a task window (`noblame commit <path>`, M8) the module fills the sidebar beside the diff tab,
limited to the folder or file given: see [cli.md](cli.md#task-windows-m8).

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
- The message box (Ctrl/⌘+Enter commits), **Amend last commit**, **Sign off**, the author, the
  Commit button (labelled **Amend** when amending) and why it is disabled. See
  [The message](#the-message-slice-4).
- Ticking Amend with an empty box fills in the last commit's message (`get_head_message`);
  unticking takes it away again unless it was edited.
- **Discard**: a **↶** button on Changes rows (not conflicted files or submodules) and in the
  Changes header (all listed files). The confirmation (`lib/discard.ts`) names the files: changed
  ones go back to the staged version, new ones are deleted, conflicts and submodules are left as
  they are, and only listed files are discarded when the list was cut at 5,000.
- **Ignore** (M4 slice 6): an eye-off button on untracked Changes rows opens `IgnoreDialog`, see
  [Ignoring files](#ignoring-files-slice-6).
- The draft (message, Amend, Sign off, author override, the template it started from) lives in
  a Zustand store keyed by repository path, kept while the app runs; a commit clears the
  message, Amend and the author and keeps Sign off.
- Git's output is shown under the button: the summary line after a commit, or everything git
  and its hooks printed when it refused (the commit error is rendered inline, not as a toast).

## The message (slice 4)

`CommitMessage` reads `get_commit_defaults` (configured author, `commit.template`, comment
character) each time it mounts.

- **Recent ▾** above the box (`MessageMenu`) lists the user's recent messages
  (`get_recent_messages`, read when the menu opens and dropped after a commit): up to 20 distinct
  full messages of commits reachable from HEAD whose author address is the configured one (any
  author when none is configured), newest first, looking at most 2,000 commits back. Choosing one
  replaces the box. **Start from the template** is at the bottom when a template is configured.
- **Template**: an empty, fresh draft is filled with `commit.template` (`useTemplateSeed`), on
  first showing and after each commit; not after the user emptied the box, nor while amending.
  While the message started from the template, its comment lines are left out with
  `--cleanup=strip` (what git does with a template in its editor) and a line under the box says
  so; the Commit button waits until the template is changed. Ticking Amend over an untouched
  template replaces it with the last message; unticking brings the template back. The path is
  read only from config files gix trusts (the repository's own config only when it is owned by
  the user), `~` expanded, relative paths taken from the working tree; at most 64 KB. When it
  cannot be read, a warning names it.
- **Author**: the line under the options shows the configured author (`author.*`, `user.*`,
  `GIT_AUTHOR_*`, via gix), "kept from the last commit" while amending, or "not configured".
  **Change** opens a field for `Name <email>` (checked as typed, and again in Rust by
  `Identity::parse`); the commit runs `git commit --author=<it>`; × goes back to the configured
  one. The override is cleared by a commit.
- **Summary hints** (`SummaryHint`, `lib/message.ts`): the summary's length (grapheme clusters,
  of the message as it will be stored) against 50 (amber above) and 72 (red above), and
  **Leave line 2 empty** when the line after the summary has text.

## Ignoring files (slice 6)

The `.gitignore` helper, on untracked files (and untracked folders, which the status lists as
`folder/`):

- **What to ignore** offers ready-made patterns (`lib/ignore.ts`): only this file (`/logs/a.log`),
  every file of that name (`a.log`), every file with its extension (`*.log`, not for dot files
  such as `.env`), and the folder it is in (`/logs/`); for a folder, the folder itself or every
  folder of that name (`out/`). Wildcards (`*`, `?`, `[`, `\`), a leading `#` or `!` and a last
  space are escaped. The **Pattern** box can be edited freely.
- Under it, the files listed now that the pattern would hide (`preview_ignore`, 250 ms after the
  last key press; a newer preview cancels the running one): the count and up to 200 names, or
  git's reason the pattern is refused.
- **Add it to** `.gitignore` (at the top of the working tree, shared once committed) or
  `.git/info/exclude` (this clone only; in a linked worktree the common git folder's). Global
  ignore files (`core.excludesFile`) are never touched.
- **Ignore** appends the line (`ignore_files`): the file and its folder are created when missing,
  the file's line endings are kept (CRLF if it has any), a missing last newline is added first,
  and a line already there is not added again (the toast says "Already in …"). Files git tracks
  are not untracked.
- The status is read again afterwards (`info/exclude` is inside `.git`, which the watcher does
  not report).

`git_core::ignore`:

- `check_pattern` refuses an empty pattern, several lines, a comment (`#`) and an unescaped last
  space (git would drop it).
- `files_hidden_by` runs `git ls-files -z --others --exclude-standard` (the untracked files listed
  now) and `git ls-files -z --others --exclude-standard --ignored --directory --exclude=<pattern>`
  (what would be ignored, ignored folders as one `folder/` entry), and keeps the first list's
  files that the second names, or whose folder it names. A pattern given with `--exclude` takes
  precedence over a `!` rule in a deeper `.gitignore`, so the preview can name a file the written
  pattern would not hide. About 0.1 s for both on git.git with 2,000 untracked files.

## Backend

| Command                                         | Runs                                                                                                |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `stage_files`                                   | `git --literal-pathspecs add --all --pathspec-from-file=- --pathspec-file-nul`                      |
| `stage_all_files`                               | `git add --all`                                                                                     |
| `unstage_files`                                 | `git --literal-pathspecs reset --quiet --pathspec-from-file=- --pathspec-file-nul`                  |
| `unstage_all_files`                             | `git reset --quiet -- .` (limited to paths, so a merge in progress is kept)                         |
| `create_commit`                                 | `git commit --file=- [--amend] [--signoff] [--author=…] [--cleanup=strip]`, the message on stdin    |
| `get_head_message`                              | gix: HEAD's commit message (`null` on an unborn branch)                                             |
| `get_commit_defaults`                           | gix: the author identity, `commit.template` (trusted config only) and `core.commentChar`            |
| `get_recent_messages`                           | gix: up to 20 of the user's messages, walking at most 2,000 commits from HEAD by date               |
| `stage_lines`, `unstage_lines`, `discard_lines` | Some changed lines of a file, see [diff.md](diff.md#staging-lines-and-hunks)                        |
| `discard_files`                                 | `git restore --worktree` (literal paths on stdin) and `git clean -f -q -- <new files>`, 200 per run |
| `preview_ignore`                                | Two `git ls-files --others` runs, see [Ignoring files](#ignoring-files-slice-6)                     |
| `ignore_files`                                  | Appends a line to `.gitignore` or `.git/info/exclude` (no git)                                      |

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

- Templates of NoBlame's own (Git Extensions keeps a list); only `commit.template` for now.
- Recent messages from other branches, or typed but never committed.
- Discarding to the recycle bin instead of deleting new files.
- Choosing several files at once (Shift/Ctrl+click).
- Ignoring a tracked file (it would need `git rm --cached` too), and several patterns at once.
- The `noblame commit <path>` task window is still the M8 placeholder.
