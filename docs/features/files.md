# Files of a revision

The **Files** module (Alt+6) shows the folders and files of the selected commit, and the **file
tab** shows one of them at that commit. Status: M3 slice 7 (2026-10-30). "Browse files at this
commit" in the commit context menu opens the module.

## Behaviour

- **Tree**: the root folder of the selected commit; folders first, then files, each by name
  ignoring case. Icons tell folders, files, executables, symbolic links and submodules apart.
- **Opening folders**: a click or Enter opens or closes a folder; Right opens it (or moves into
  it), Left closes it (or moves to its folder). Folders are read when opened, so a tree of
  100,000 files costs only what is shown.
- **Showing a file**: a click, Enter, or moving onto it with the arrows shows it in the file
  tab, like Changed files and the diff tab. The file tab opens in the same group as the diff
  tab (or to the right of the repository tab when there is none); the diff tab joins it the same
  way.
- **Following the selection**: open folders, the row with the cursor and the chosen file are
  kept by path per repository. Selecting another commit shows its tree with the same folders
  open, and the file tab shows the same path at that commit, or says the commit does not have
  it.
- **File tab**: the file's lines with line numbers and syntax colours (the diff tab's setting),
  virtualized and paged like the diff; images as a picture; binary files, files over 64 MB and
  empty files are named instead. A symbolic link shows its target; a submodule shows the
  commit it points at. **Save as…** writes the file.
- **Context menu** on a row (right click, Shift+F10, Menu key): Show / Open / Close, Save as…,
  Copy path, Copy name, File history (Folder history for a folder; [history.md](history.md)),
  Blame ([blame.md](blame.md)).
- The file tab's **History** and **Blame** buttons show the file's history and its blame at
  the commit shown.
- **Save as…** asks where to save (the native dialog, proposing the file's name) and writes the
  file exactly as the repository stores it: no line-ending conversion, no other filters. A
  Git LFS file saves its pointer.
- Working tree rows and no selection explain that a commit must be selected.

## How it works

- `git_core::tree`:
  - `list_tree(repo, tree_id)` lists one folder (at most `MAX_TREE_ENTRIES` = 50,000, folders
    first, with the total);
  - `entry_at(repo, commit, path)` finds the entry at a path (`""` is the root folder);
  - `save_blob(repo, blob, destination)` writes a blob's bytes.
- `git_core::diff::file_view(repo, blob, attribute)` shows a blob whole. The rows are the diff
  tab's: every line is an unchanged row and there is no hunk header. Lines, paging and syntax
  colours therefore work as in diffs. The view is cached in the session's diff cache
  (`DiffKey.whole`).
- Commands: `get_tree_entry`, `list_tree`, `get_file_view`, `get_file_view_lines` and
  `save_file_as` (see [ipc.md](../architecture/ipc.md)). `save_file_as` opens the save dialog in
  Rust, so the webview never names a path to write.
- Frontend: `src/features/files/`.
  - Listings are cached by folder id (content-addressed, never stale), so folders the next
    commit did not change show at once.
  - The entry at a path is cached under the graph's keys (it depends on the row).
  - `useTreeRows` reads the open folders it already has, then loads the open folders inside
    them.
  - `FileContents` (diff feature) renders the file tab's body.
- `VirtualList` got tree semantics (`role="tree"`, `aria-level`, `aria-expanded`) and a hook
  for extra keys. Pressing a row with a button other than the primary one only moves the
  cursor, so context menus open without activating the row.
- `openModuleById` (workbench) lets the commit menu open the module without importing the app's
  module registry.

## Performance

Measured in the debug build through IPC (2026-10-30):

- Linux kernel: the root entry takes 1.3 ms; listing a folder takes 1.3–6 ms (`include/linux`
  has 1,614 entries).
- A folder of 100,000 files takes 163 ms and sends the first 50,000 entries (4.5 MB).
- Opening that folder again from the cache shows it within 13–17 ms.

## Not yet

- Filtering the tree by name, and "find file".
- Opening a file in an external program (writing a temporary copy and opening it with its
  default program), and saving through Git's filters (line endings, LFS contents).
- Comparing two revisions of a file (M3 slice 9).
- Non-UTF-8 file names are shown lossily, and looking such a file up at another commit by its
  path does not find it.
