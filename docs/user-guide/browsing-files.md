# Browsing the files of a commit

Open **Files** from the activity bar (or press **Alt+6**). It shows every folder and file as they
were at the selected commit. You can also right-click a commit and choose **Browse files at
this commit**.

- Click a folder, or press **Enter**, to open or close it. **Right** opens a folder or moves into
  it; **Left** closes it or moves up to its folder.
- Click a file, or move onto it with the arrow keys, to show it in the **File** tab. The tab
  shows the file with line numbers and colours; pictures are shown as pictures.
- Select another commit and the tree and the File tab follow it. Open folders stay open, and the
  File tab shows the same file at that commit, or tells you that commit does not have it.

## Saving a file

Click **Save as…** in the File tab, or right-click a file and choose **Save as…**. Pick where to
save it. NoBlame saves the file exactly as it is stored in the repository. For example, line
endings are not converted, and a Git LFS file is saved as its small pointer file.

Right-click a file or folder to copy its path or name.

## Limits

- A folder with more than 50,000 entries lists the first 50,000.
- Files over 64 MB, and binary files that are not pictures, are not shown; you can still save
  them.
- File history and blame are coming next; they are shown greyed out in the menu.
