# Commit graph

The history of a repository as a graph with commit columns, in every repository tab.
Architecture: [commit-graph.md](../architecture/commit-graph.md). User guide:
[commit-graph.md](../user-guide/commit-graph.md).

Status: **M2 in progress.** The graph, columns, labels, selection and keyboard navigation are
done; artificial working-tree rows, stash labels, the on-disk cache, the file watcher and commit
details (M3) are not.

## Columns

| Column  | Content                                                                                  |
| ------- | ---------------------------------------------------------------------------------------- |
| Graph   | Lanes and commit nodes drawn on a canvas; capped at 16 lanes wide (wider graphs are cut) |
| Message | Reference labels, then the first line of the commit message                              |
| Author  | Author name (e-mail in the tooltip)                                                      |
| Date    | Author date, local time, medium date and short time                                      |
| Commit  | The first 8 characters of the commit id                                                  |

Rows whose text is still loading show a grey placeholder bar.

## Reference labels

| Kind          | Look                |
| ------------- | ------------------- |
| Local branch  | Green, branch icon  |
| Remote branch | Blue, globe icon    |
| Tag           | Amber, tag icon     |
| Detached HEAD | Yellow label "HEAD" |

The branch HEAD points to is bold and outlined. Labels are sorted: detached HEAD, local
branches, remote branches, tags. The tooltip names the kind and the full short name. Labels are
truncated when the column is narrow.

## Nodes and lines

- Each branch line keeps one colour from where it starts to where it ends (8 colours, cycled).
- A merge commit is a hollow node; lines from merged branches join it with a curve.
- The HEAD commit has a yellow ring.
- Colours follow the theme (light and dark palettes).

## Selection and navigation

- Click a row to select it.
- With the list focused: **Up/Down** move one row, **Page Up/Page Down** one screen, **Home/End**
  go to the first or last commit. The selection scrolls into view.
- On first open the HEAD commit is selected and scrolled into view.
- Selection and scroll position are remembered per repository while switching tabs.
- Screen readers: the list is a listbox named "Commit history, N commits"; each row is labelled
  with its summary and author.

## Uncommitted changes

When the repository has uncommitted changes, up to two rows sit above the newest commit (as in
Git Extensions):

- **Working tree changes**: changed, untracked and conflicted file counts;
- **Staged changes**: the number of staged files.

Each row appears only when it has something to show. Their hollow nodes sit in HEAD's lane and
are joined to the HEAD commit by a dashed line. They can be selected like commits (click,
arrows); the Commit details module then shows the counts. **Placeholder:** the file lists,
diffs and staging arrive in M4.

The counts come from `get_status_summary` (`git status --porcelain=v2 -z`, read-only, so the
user's fsmonitor, untracked cache and `status.showUntrackedFiles` apply). They are read when
the repository opens and every time the window regains focus; the file watcher will refresh
them as files change.

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

## Not yet

Stash labels, on-disk cache, automatic refresh by a file watcher, the working tree file lists
(M4), commit details and diffs (M3), resizable columns.
