# File history

The **History** tab lists every commit that changed a file, newest first, even across renames.

## Opening it

- In **Files** (Alt+6), right-click a file and choose **File history**. For a folder, choose
  **Folder history**.
- In the **File** tab, click **History**.

## Reading it

Each row shows:

- what the commit did to the file: **A** added, **M** modified, **D** deleted, **R** renamed,
  or a merge symbol;
- the commit's short id and summary;
- the file's old name, if it had another name in that commit;
- the author and the date.

The top line shows how many commits there are and the names the file had before.

## Looking at a change

Click a row, or move to it with the arrow keys. The commit is selected in the graph, and the
**Diff** tab shows what that commit changed in the file. For a folder, the commit is selected
and **Changed files** lists its files.

## Good to know

- The history follows renames. If the file was renamed on one branch and edited under its old
  name on another, both edits are listed.
- It covers the branches the graph shows. If you filter the graph to one branch, the history
  shows that branch only. Commits that the graph's other filters hide are shown faded and
  cannot be selected.
- On very large repositories, reading a history can take several seconds. It is much faster
  once the repository has a commit-graph file: if NoBlame suggests writing one, accept it
  ([Opening repositories](opening-repositories.md)).
- In a partial clone (one that downloads old file contents only when needed), NoBlame cannot
  always tell where a renamed file came from. The history then ends there and says so.
