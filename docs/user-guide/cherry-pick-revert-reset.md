# Cherry-picking, reverting and resetting

Right-click a commit in the graph to copy it onto your branch, undo it, or move your branch back
to it. Each one opens a small window first, so nothing happens by accident.

## Cherry-pick: copy a commit onto your branch

**Cherry-pick…** takes the changes of that commit and makes a new commit with them on the branch
you are on. Useful for bringing one fix from another branch without merging all of it.

- **Only stage the changes**: the changes go into your files and are staged, but not committed.
  Look them over and commit them in the Commit module.
- **Note where it came from**: adds a line "(cherry picked from commit …)" to the message.

If your branch already has those changes, nothing happens and NoBlame tells you so.

## Revert: undo a commit

**Revert…** makes a new commit that does the opposite of the chosen one. The old commit stays
in the history; this is the safe way to undo something you have already pushed.

**Only stage the changes** works as for a cherry-pick. A bar above the commits then says
"Reverting"; commit the changes in the Commit module, or click **Continue** in the bar to commit
them with Git's message.

## Commits that merged two branches

A merge commit joins two branches, so Git needs to know which side to compare it with. The
window asks: choose **Parent 1** (the branch it was merged into) unless you know you need the
other side. Reverting a merge with parent 1 removes everything that merge brought in.

## When files conflict

If the commit changes lines that are different on your branch, the cherry-pick or revert stops
and the bar above the commits appears, as for a [merge](merging.md#when-files-conflict). Resolve
and stage the files, then click **Continue**. **Skip** leaves this commit out, and **Abort** puts
everything back as it was.

## Reset: move your branch to a commit

**Reset the current branch to here…** makes your branch point at the chosen commit. Choose what
happens to your files:

- **Soft**: only the branch moves. The changes of the commits it leaves are staged, ready to be
  committed again (for example as one commit).
- **Mixed** (chosen at first): the branch moves and nothing is staged. Every change stays in your
  files.
- **Keep my changes**: your files match the commit, but changes you have not committed stay.
  If they are in files the reset would change, nothing happens and NoBlame says why.
- **Hard**: your files match the commit exactly. Changes you have not committed are **lost for
  good**. New files Git does not track yet stay.

Before you confirm, the window lists the commits that leave your branch. They are not deleted
right away: other branches that have them keep them, and Git remembers them for a while.
For **Hard** it also says how many files lose their uncommitted changes, and the button turns
red.
