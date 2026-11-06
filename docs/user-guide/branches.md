# Branches and tags

You can check out, create, rename and delete branches, and create and delete tags, from two
places:

- **The commit graph**: right-click a commit. **Check out this commit…**, **Create a branch
  here…** and **Create a tag here…** act on that commit; each branch or tag on it has its own
  submenu.
- **The Branches module** (Alt+2): right-click a branch or tag. With a branch chosen in the
  list, **F2** renames it and **Delete** deletes it.

## Checking out

- **Check out** a branch to switch to it. If you have changes that the switch would overwrite,
  NoBlame tells you what Git said and changes nothing: commit or stash them first.
- **Check out this commit…** shows the files of that commit without being on a branch. Commits
  you make there belong to no branch, so create a branch before you switch away. The dialog
  offers **Create a branch here instead…**.
- **Check out as a new local branch…** on a remote branch (such as `origin/feature`) creates
  your own branch with the same name, switches to it, and connects it to the remote one, so
  pulling and pushing go there.

## Creating

- **Create a branch here…** asks for a name. Leave **Check out the new branch** ticked to switch
  to it straight away.
- **Create a tag here…** asks for a name and, if you like, a message. A tag with a message
  records who made it and when (Git signs it if you have set that up); without one it is only a
  name.

NoBlame checks the name as you type: no spaces, no special characters such as `~ ^ : ? * [`,
and no name that exists already.

## Renaming and deleting

- **Rename…** gives a branch a new name. A copy you already pushed keeps its old name on the
  remote.
- **Delete…** always asks first and tells you what you would lose: the commits that no other
  branch or tag contains, with the newest ones listed. If every commit is also somewhere else,
  only the name goes. You cannot delete the branch you are on.
- Deleting a tag removes it from your computer only; a copy pushed to a remote stays there.

If someone changed the branch or tag in the meantime (for example in a terminal), NoBlame does
nothing and asks you to look again.
