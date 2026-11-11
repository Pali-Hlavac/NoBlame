# Patches and archives

A patch is a file holding a commit's changes and its message. You can send it to someone (by
mail, in a chat) who applies it to their copy of the repository, or keep it for later. An
archive is a zip or tar.gz file with all the files of a commit, without the history: handy for
a release.

## Creating patches

Right-click a commit in the graph → **More** → **Create patches…**.

- **Only this commit**, or **the commits after a branch, tag or commit, up to this one**: type
  where they start, such as `origin/main` or `v1.0`. NoBlame says how many commits that is.
  Merge commits are left out: a patch cannot hold a merge.
- For several commits, choose **One file holding them all** or **One file per commit, in a
  folder** (named `0001-Subject.patch`, `0002-…`). NoBlame never replaces files already in the
  folder: it tells you which ones are in the way.

Click **Save…** and choose where.

## Applying patches

Open the **Commit** button's menu (the arrow next to it) → **Apply patches…**, or search for it
in the command palette (Ctrl+K). Click **Choose patch files…**; they apply in the order of
their names.

NoBlame shows what each file holds (the commits in it, or a change without a message) and
checks them before anything changes:

- **They apply cleanly**;
- **they apply with a three-way merge**: your files differ a little from what the patch expects,
  and Git can still combine them;
- **with conflicts**: some lines changed on both sides; you resolve them afterwards;
- **they do not apply here**, with Git's reason.

Then choose how:

- **Make commits from them**: each commit in the file becomes a commit on your branch, with its
  message and author. If one has conflicts, applying stops; resolve the files, stage them and
  choose **Continue** in the bar above the commits (or **Skip** that patch, or **Abort**).
- **Only change the files**: you review the changes and commit them yourself.

## Saving an archive

Right-click a commit → **More** → **Save an archive…**. Choose **Zip** or **Tar, gzip-compressed**
and whether the files go in a folder inside the archive (it is named after the repository and
the tag, such as `app-v1.0`). Click **Save…** and choose where. Large repositories take a
while: the progress shows in a notification, where you can cancel. Submodules' files are not
included.
