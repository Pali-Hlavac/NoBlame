# Git LFS

Git LFS (Large File Storage) keeps big files, such as images, videos or builds, outside the
history: the repository stores a small pointer, and the content lives on an LFS server. It is a
Git add-on; install it from [git-lfs.com](https://git-lfs.com) if your repositories use it.

## The Git LFS module

Open **Git LFS** in the activity bar (Alt+0). It lists the repository's LFS files with their
sizes. A file marked **pointer only** has not been downloaded: your folder holds only the
pointer. **Download contents** downloads them all; the progress shows in a notification, where
you can cancel.

If Git LFS is not installed, or the repository has no LFS files, the module says so.

## Locks

Some teams lock files that cannot be merged (a Photoshop file, a 3D scene), so two people do not
change them at the same time. Locks are kept on the LFS server, so NoBlame asks for them only
when you click **Show locks**: each lock names the file and who holds it.

- To lock a file, point at it in the list and click the lock icon.
- To release a lock, click **Unlock**. If it is someone else's lock, NoBlame asks first:
  forcing it open lets anyone change the file, and they may lose work if they are still editing
  it.

Locks need an LFS server, such as GitHub's or GitLab's. For a remote without one, NoBlame shows
Git LFS's message and explains it.
