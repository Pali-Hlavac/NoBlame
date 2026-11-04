# Stashing

A stash puts changes aside: they are saved and taken out of your files, so you can switch to
other work and bring them back later. Open **Stashes** from the toolbar or the activity bar
(Alt+4).

## Stashing changes

Click **Stash changes…** at the top of the Stashes module.

- Give the stash a message if you like, so you recognise it later.
- Every changed file is ticked. Untick the ones to leave in your working tree (click the box, or
  press Space on a file).
- **Include new files** stashes files Git does not track yet too; they are removed from the
  folder until you bring the stash back.
- **Keep staged changes in place too** stashes everything but leaves what you staged where it is,
  for example to test only the staged part before committing it.

Click **Stash**. The changes disappear from your files and the stash appears at the top of the
list as `stash@{0}`; older stashes move down one number.

## Looking at a stash

Click a stash in the list. The **Stash** tab opens beside the commit graph with the files the
stash holds (new files are marked **?**). Click a file to see what the stash changed in it.

## Bringing changes back

In the Stash tab, or from the **…** menu next to a stash:

- **Apply** puts the stash's changes back into your files and keeps the stash.
- **Pop** does the same and then deletes the stash, unless there were conflicts.
- Tick **Restore staged changes too** to have what was staged staged again.

If your files changed in the same places since you stashed, Git marks conflicts in them, as it
does in a merge: fix them, then stage the files in the Commit module. If a file you changed would
be overwritten, nothing happens and NoBlame says which file is in the way: commit or stash it
first.

### Only some files

Tick the files you want in the Stash tab and click **Apply N chosen**. Only their changes come
back; the stash stays as it is. The chosen files must not have changes of their own (NoBlame names
them if they do). If your branch has moved on since you stashed, the changes are merged into the
files as they are now, so nothing that was committed meanwhile is undone.

In the commit graph, a `stash@{n}` label marks the commit each stash was made on.

## Dropping a stash

**Drop…** (in the Stash tab or the **…** menu) deletes a stash after asking. Its changes are gone
for good, except what you already applied.
