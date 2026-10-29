# Viewing changes

## The files a commit changed

Open **Changed files** from the activity bar (or press **Alt+5**). It lists the files the
selected commit changed:

- **A** added, **M** modified, **D** deleted (struck through), **R** renamed, **C** copied. A
  renamed file shows its old name.
- A merge commit is compared with its first parent. Use **Compared with** to pick another parent.
- A commit that changed more than 5,000 files lists the first 5,000.

## The diff of a file

Click a file, or move through the list with the arrow keys. Its diff appears in the **Diff**
tab, which opens to the right of the commit graph the first time. You can drag the tab anywhere,
and it stays there: choosing another file changes what it shows, not where it is.

- Removed lines are red and start with `-`, added lines are green and start with `+`. The two
  number columns are the line numbers before and after the change.
- Lines starting with `@@` mark where each changed part of the file begins.
- When a line was edited, the words that changed are marked in a stronger colour, so a small
  fix in a long line is easy to spot.
- Code is coloured by its language. You can switch this off in **Settings → Diff**.
- The top of the tab shows the file, its folder and how many lines were added and removed.
- When you select another commit, the Diff tab keeps showing the same file if that commit
  changed it too.
- Click the diff (or press Tab until it is focused) to scroll it with the arrow keys, Page Up
  and Page Down.

The bar at the top of the Diff tab changes how every diff is shown. NoBlame remembers your
choice, and **Settings → Diff** has the same options.

- **Unified** shows one column. **Side by side** shows the old version on the left and the new
  one on the right. In side by side, scroll sideways with the bar under the diff, with
  Shift + mouse wheel, or with the left and right arrow keys.
- **Whitespace**: show every change, or ignore spaces at the end of lines, changes in the amount
  of spaces, or all spaces. Handy when someone re-indented a file. If only whitespace changed,
  the tab says so.
- **Context**: how many unchanged lines appear around each change (3, 10 or 25), or the
  **whole file**.

Images (PNG, JPEG, GIF, WebP, BMP, ICO, AVIF) are shown as pictures: before on the left, after
on the right, with their size in pixels and bytes. A checkerboard shows through transparent
parts.

Some files have no line diff. The tab then says why:

- other binary files (it shows their sizes), including files your repository's
  `.gitattributes` mark as `binary`;
- files larger than 64 MB;
- files that were only renamed, or whose permissions changed.

In a partial clone (made with `git clone --filter=blob:none`), older versions of files may not be
on your computer yet. NoBlame says so; it does not download them.

Coming later: the changes in your working tree (with staging).
