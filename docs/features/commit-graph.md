# Commit graph

The history of a repository as a graph with commit columns, in every repository tab.
Architecture: [commit-graph.md](../architecture/commit-graph.md). User guide:
[commit-graph.md](../user-guide/commit-graph.md).

Status: graph, columns, labels, selection, keyboard navigation, working tree rows, highlight and
live reloads are done (M2, M2.5). Filters are in progress (M3 slice 4): branch, first parent, no
merges, message, author and path are done. Stash labels are done (M4 slice 5).

## Columns

| Column  | Content                                                                                  |
| ------- | ---------------------------------------------------------------------------------------- |
| Graph   | Lanes and commit nodes drawn on a canvas; capped at 16 lanes wide (wider graphs are cut) |
| Message | Reference labels, then the first line of the commit message                              |
| Author  | Initials badge and author name (e-mail in the tooltip); see "Initials badges" below      |
| Date    | Author date, local time, medium date and short time                                      |
| Commit  | The first 8 characters of the commit id                                                  |

Columns are chosen in Settings (`graph.columns`: order, `visible`, `width`; `graph.dateDisplay`:
`absolute` or `relative`), from the column header or Settings → Commit graph:

- The header's right-click menu and its columns button (same items): show or hide columns, the
  date display, **Reset columns**. The message cannot be hidden.
- Dragging a title moves its column (HTML drag and drop, `application/x-noblame-graph-column`);
  the graph stays first. Settings lists the columns with move up / down buttons for the
  keyboard.
- Each column but the message has a resize handle at its right edge (a focusable separator:
  arrows ±8 px, Delete for the default, double-click for the default). Widths are 48 to 600 px;
  the drag shows the width live and saves it on release. The graph's default fits its lanes (at
  most 16); a narrower graph is cut at its edge. Hiding the graph keeps an empty first cell and
  skips the canvas.
- Relative dates: "just now", "5 min ago", "3 h ago", "2 d ago", "4 mo ago", "6 y ago"
  (`formatRelativeDate`), refreshed every minute; the tooltip has the date and time. Only the
  commit graph uses this setting.
- In narrow panes the Commit, Author and Date columns still drop out in that order
  (`layoutColumns`).
- The list always reserves its scrollbar's width (`scrollbar-gutter: stable`) and the header
  leaves the same room (`--scrollbar-size`), so the titles line up with the rows; the columns
  button sits in that room.

Rows whose text is still loading show a grey placeholder bar.

## Reference labels

| Kind          | Look                                                                     |
| ------------- | ------------------------------------------------------------------------ |
| Local branch  | Green, branch icon                                                       |
| Remote branch | Blue, globe icon                                                         |
| Tag           | Amber, tag icon                                                          |
| Detached HEAD | Yellow label "HEAD"                                                      |
| Bisect mark   | `bad` red, `good` green, `skipped` grey, with a search icon (M7 slice 3) |

The branch HEAD points to is bold and outlined. Labels are sorted: detached HEAD, local
branches, remote branches, tags. The tooltip names the kind and the full short name. Labels are
truncated when the column is narrow.

**Stash labels** (`StashBadge`): an amber outlined `stash@{n}` with a box icon on the commit each
stash was made on (its first parent), after the reference labels; the tooltip has the stash's
message. They are not references: the stash commits themselves (and their index and untracked
commits) are not rows, stashes are not tips of the walk, and Branches, filters, Contained in, the
commit menu and find ignore them. `get_commit_rows` adds them to each page (`CommitRowDto.stashes`)
from the `refs/stash` reflog and each stash's first parent (`stash_bases`), so a stash made or
dropped in a terminal shows after the watcher's reload. The stash itself is shown in the Stash tab
([stashes.md](stashes.md)).

## Nodes and lines

- Each branch line keeps one colour from where it starts to where it ends (8 colours, cycled).
- A merge commit is a hollow node; lines from merged branches join it with a curve.
- The HEAD commit has a yellow ring.
- Colours follow the theme (light and dark palettes).

## Find and go to commit

- **Find** (Ctrl+F, palette "Find commits…"): a bar under the filter bar.
  - It matches the commit id (at least 4 hex digits, as a prefix), branch and tag names, the
    author's name or e-mail, and the whole message, ignoring case.
  - Typing searches after 300 ms and selects the first match at or below the selected commit.
  - **Enter** / **Shift+Enter** (or the arrows) go to the next older / newer match and wrap
    around; the bar shows "3 of 120", "No matches" or "Searching…"; **Esc** closes it.
  - The search covers the shown graph, so a filter limits it.
- **Go to commit** (Ctrl+Shift+G as in Git Extensions, palette "Go to commit…"): a dialog that
  resolves git's revision syntax with gix (full or short id, branch, remote branch, tag,
  `HEAD~2`, `main^2`) and selects the commit.
  - A commit the filter hides offers **Show all commits and go there**.
  - A commit outside the graph (a stash, a dropped commit) is explained.
  - An unknown name says so, with a hint.
- Both act on the active repository, also while the Diff tab has focus.
- Backend: `Graph::find_rows` (`graph/find.rs`).
  - Ids and ref names are checked in memory; the other commits are read on up to 16 threads,
    with the scan of the author/message filters.
  - The session keeps the rows of the last query (`sessions/find.rs`), so Next and Previous are
    binary searches.
  - A new query cancels a search still running.
- Cost of the first search of a query: 0.4–0.7 s on synthetic-1m, 0.7–1.8 s on the Linux kernel.

## Context menu

Right-clicking a commit selects it and opens its menu; **Shift+F10** or the **Menu** key opens
the menu of the selected commit (owner request 2026-10-30). The menu starts with the short id and
subject.

| Entry                                                          | Status                                           |
| -------------------------------------------------------------- | ------------------------------------------------ |
| Copy ▸ Commit id, Short commit id, Subject, Whole message      | Works                                            |
| Highlight its history / Clear the highlight                    | Works (when highlighting is on)                  |
| Browse files at this commit                                    | Works (opens the Files module)                   |
| Compare with HEAD                                              | Works (the compare tab)                          |
| Compare with the working tree                                  | Works (not in bare repos)                        |
| Check out this commit, Create a branch here, Create a tag here | Works ([branches.md](branches.md))               |
| Merge into the current branch                                  | Works ([operations.md](operations.md))           |
| Cherry-pick, Revert, Reset the current branch to here          | Works ([operations.md](operations.md))           |
| Rebase the current branch onto this                            | Works ([operations.md](operations.md))           |
| Interactive rebase from here                                   | Works ([operations.md](operations.md))           |
| A submenu per branch or tag on the commit                      | See below; merge and rebase work                 |
| More ▸ Bisect: mark as bad, good, skip                         | Works ([operations.md](operations.md#bisecting)) |
| More ▸ Create patches, Save an archive                         | Works ([patches.md](patches.md))                 |
| More ▸ Run a script                                            | Disabled, **M7**                                 |

Each disabled entry names the milestone that delivers it. A branch's submenu offers:

- Check out (works), Merge into the current branch, Rebase onto it (not for the current branch);
- Rename (works), Delete (works; not for the current branch), Push… (works);
- Compare with the current branch (works);
- Copy name.

Remote branches offer:

- Check out as a new local branch (works);
- Merge, Rebase (work);
- Delete on the remote… (works).

Tags offer Merge and Rebase, Push… and Delete on a remote… (work), Delete (works) and Copy name. The branch and tag actions come from
the branches feature through `RefActionsContext` ([branches.md](branches.md#code)).

Working tree rows have no menu yet (M4). The entries are data (`lib/commitMenu.ts`); the menu
is Radix's context menu (`@radix-ui/react-context-menu` 2.4.1, MIT, `shared/ui/context-menu.tsx`).

## Selection and navigation

- Click a row to select it. **Ctrl+click** (Cmd+click on macOS) another commit to compare
  the two in the compare tab; the selection stays ([compare.md](compare.md)). While the key is
  held over another commit, `CompareHint` shows "Click to compare with <id> <subject>" at the
  pointer (its own component and listeners, so moving the mouse does not re-render the list).
- With the list focused: **Up/Down** move one row, **Page Up/Page Down** one screen, **Home/End**
  go to the first or last commit. The selection scrolls into view.
- On first open the HEAD commit is selected and scrolled into view.
- Selection and scroll position are remembered per repository while switching tabs.
- Screen readers: the list is a listbox named "Commit history, N commits"; each row is labelled
  with its summary and author.

## Initials badges

`PersonBadge` (`src/shared/components/`) draws up to two initials (first and last word of the
name) in a circle. Its hue is 32-bit FNV-1a of the trimmed, lower-case e-mail address (the name
when there is none) modulo 360 (`src/shared/lib/person.ts`), so a person has the same colour on
every device; lightness, chroma and the text colour are the `--person-*` tokens of the theme
(`bg-person` utility). Owner decision 2026-11-03: hash the e-mail, not the name. Shown in the
Author column and in Commit details (author, committer); decorative (`aria-hidden`), the name is
always written beside it.

## Uncommitted changes

The graph reloads by itself when HEAD or a branch moves outside the app (see
[repositories.md](repositories.md#live-updates)).

When the repository has uncommitted changes, up to two rows sit above the newest commit (as in
Git Extensions):

- **Working tree changes**: changed, untracked and conflicted file counts;
- **Staged changes**: the number of staged files.

Each row appears only when it has something to show. Their hollow nodes sit in HEAD's lane and
are joined to the HEAD commit by a dashed line. They can be selected like commits (click,
arrows); Changed files then lists the row's files and the diff tab shows the chosen one
([changed-files.md](changed-files.md#working-tree-files-m4-slice-1)), and Commit details shows
the counts. **Placeholder:** staging and committing arrive in M4.

The counts come from `get_status` (`git status --porcelain=v2 -z`, read-only, so the user's
fsmonitor, untracked cache and `status.showUntrackedFiles` apply; untracked files are counted
one by one). They are read when
the repository opens, whenever a file changes, and every time the window regains focus (watcher, see [repositories.md](repositories.md#live-updates)).

**Settings → Commit graph → Show uncommitted changes as**: rows at the top of the commit graph
(default), a summary in the repository header, or not shown. Bare repositories have none.

Implementation: the list works in "display indexes" (working tree rows first, then commits;
`lib/displayRows.ts`). The canvas and the commit text keep using graph rows, so the working
tree rows are graph rows `-1` and `-2` for the renderer (`lib/drawWorkingTree.ts`). The shared
selection is a commit row or `{ kind: "worktree" | "index" }` (`features/selection`).

## Highlighting the selected commit

Selecting a commit (click or keyboard) highlights it, as long as **Settings → Commit graph →
Highlight the selected commit** is on (the default):

- Its history stays bright: the commit, every ancestor, and the lines leading into it, including
  the lines of merged branches below their merge. Everything else is dimmed.
- The rows of commits by the same author (compared by email, ignoring case) get a tint, and the
  author is shown in bold.
- **Esc** in the commit list clears the highlight; the commit stays selected. Selecting any commit
  again, including the same one, shows the highlight again.

The history comes from the backend as an overlay per block (`get_ancestry_block`, see
[architecture/commit-graph.md](../architecture/commit-graph.md#highlighted-history)). While a block's
overlay is loading, its rows are drawn dimmed; it usually arrives within a few milliseconds.

## Filters

A bar above the column titles chooses what the tab shows (ADR
[0021](../adr/0021-graph-filters.md)):

| Control             | Shows                                                                                                       |
| ------------------- | ----------------------------------------------------------------------------------------------------------- |
| Branch picker       | **All branches** (default), **Current branch** (HEAD's history), or one branch or tag                       |
| **First parent**    | Only first parents are followed and drawn: the main line of each branch (`--first-parent`)                  |
| **No merges**       | Merge commits are left out (`--no-merges`)                                                                  |
| **Message**         | Commits whose message (subject or body) contains the text, ignoring case                                    |
| **Author**          | Commits whose author name or e-mail contains the text, ignoring case                                        |
| **Path**            | Commits that change the file or folder (relative to the repository root), as `git log -- <path>` finds them |
| Count and **Clear** | "N of M commits" while filtered; **Clear** shows every commit again                                         |

- The branch picker lists local branches, remote branches and tags, with a search field. It shows
  at most 200 references; typing narrows the list (repositories have up to tens of thousands).
- Filters combine: for example one branch, first parent, no merges, and an author.
- **Message** and **Author** apply half a second after typing stops, or at once on **Enter**.
  **Esc** empties the field. A field with text has a coloured border. The text is plain, not a
  regular expression.
- **Path** is a git pathspec relative to the repository root: `src/`, `README.md`, `*.rs`.
  Backslashes become slashes. An absolute path inside the repository (pasted from a file
  manager) is made relative. git lists the commits (`git rev-list <tips> -- <path>`, default
  history simplification), so its changed-path Bloom filters apply. Renames are not followed:
  that is file history (slice 7). Matching is case-sensitive, as in git.
- Searching text reads every commit still shown: about a second on huge histories (1.2–1.9 s
  for the 1.5M commits of the Linux kernel). Typing on cancels the search under way.
- Lines join each shown commit to its nearest shown ancestors (git's parent rewriting). A hidden
  merge joins its child to both sides, so the commit has two lines but is not drawn as a merge.
- A change applies at once and shows "Filtering…" until the new view is ready. The selected
  commit stays selected if the filter shows it. Otherwise HEAD is selected, or the first commit.
  The list scrolls to the selection.
- The filter belongs to the tab's session. It survives reloads after changes outside the app,
  and is reset when the tab is closed (remembering filters is planned for M7).
- Commit details reads the full history: parents hidden by the filter are shown in grey and
  cannot be clicked, and "Contained in" counts every reference.
- In the Branches module, a reference whose commit the filter hides is dimmed and cannot be
  selected.
- When nothing matches (for example the chosen branch was deleted), the tab says "No commits
  match the filter" with **Show all commits**.

Not yet: committer and date range, regular expressions, following renames.

## States

- **Loading**: "Reading history…" while the graph is built (about half a second for a million
  commits with a commit-graph file).
- **Empty repository**: "No commits yet".
- **Error**: "Could not read the history" with the reason and **Try again**.
- A block that fails to load shows a toast; the rest of the graph keeps working.

## Edge cases

- Commit messages and names that are not valid UTF-8 are shown with replacement characters (�).
- Shallow clones end at the shallow boundary; no missing-parent errors.
- Commits whose objects are missing (partial clones) lose that parent line instead of failing
  the graph; they are counted in the graph summary (`missingParents`).
- Clock skew: a commit is never shown below its parent, even when its date is older.
- Above about 385,000 commits the scroll bar is scaled (browser height limits), so the mouse wheel
  moves faster through the history.
- Annotated tags are shown on the commit they point to; tags on trees or blobs are ignored.

## Verified

- 2026-10-27, Windows 11, dev build: the 1M-commit synthetic repository opened from the command
  line; graph, labels, HEAD ring, hollow merges, curves and columns rendered; HEAD selected on open.
- Not verified interactively in the running app yet: scrolling to the very end and keyboard
  navigation (covered by unit tests of the viewport mapping and the navigation logic).

- 2026-10-28, Windows 11, dev build: the highlight on synthetic-10k (main's history bright,
  merged topic lines lit below their merges, other branches dimmed, the author's rows tinted) and
  on a one-commit submodule.

- 2026-10-29: the filter bar renders in the owner's running dev app (passive capture). Clicking
  through it was not possible while the owner worked in it; a component test covers the toggles,
  the branch picker, the text fields and **Clear**.

## Not yet

Staging from the working tree rows (M4), committer and date filters, more columns
(committer, committer date, e-mail).
