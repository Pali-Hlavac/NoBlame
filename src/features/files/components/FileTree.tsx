import { showFileTab } from "@/features/workspace";
import { VirtualList } from "@/shared/components/VirtualList";

import { useTreeRows } from "../hooks/useTreeRows";
import { describeRow, parentRow, type TreeRow } from "../lib/rows";
import { useExpanded, useFilesStore } from "../store/files";
import { FileTreeMenu } from "./FileTreeMenu";
import { FileTreeRow } from "./FileTreeRow";

/** Height of one row, in CSS pixels (as in Changed files). */
const ROW_HEIGHT_PX = 26;

interface FileTreeProps {
  repoId: number;
  repoPath: string;
  /** The commit's root folder. */
  rootId: string;
  /** Accessible name, e.g. "Files at 1a2b3c4d". */
  label: string;
}

/**
 * The folders and files of one commit, folders read as they are opened. Keyboard: arrows move,
 * Right opens a folder (or goes into it), Left closes it (or goes to its folder), Enter opens a
 * folder or shows a file in the file tab.
 */
export function FileTree({ repoId, repoPath, rootId, label }: FileTreeProps) {
  const expanded = useExpanded(repoPath);
  const rows = useTreeRows(repoId, rootId, expanded);
  const cursor = useFilesStore((state) => state.cursor[repoPath]);
  const found = cursor === undefined ? -1 : rows.findIndex((row) => row.path === cursor);
  const activeIndex = found < 0 ? undefined : found;
  const { setExpanded, setCursor, choose } = useFilesStore.getState();

  const show = (row: TreeRow): void => {
    if (row.type !== "entry") return;
    choose(repoPath, row.path);
    showFileTab();
  };
  /** Enter or a click: a folder opens or closes, anything else is shown in the file tab. */
  const activate = (row: TreeRow | undefined): void => {
    if (row?.type !== "entry") return;
    if (row.entry.kind === "folder") setExpanded(repoPath, row.path, !row.expanded);
    else show(row);
  };
  const onKey = (key: string, index: number | undefined): boolean => {
    const row = index === undefined ? undefined : rows[index];
    if (index === undefined || row?.type !== "entry") return false;
    const folder = row.entry.kind === "folder";
    if (key === "ArrowRight" && folder) {
      const child = rows[index + 1];
      if (!row.expanded) setExpanded(repoPath, row.path, true);
      else if (child && child.depth > row.depth) setCursor(repoPath, child.path);
      return true;
    }
    if (key === "ArrowLeft") {
      const parent = parentRow(rows, index);
      if (folder && row.expanded) setExpanded(repoPath, row.path, false);
      else if (parent !== undefined) setCursor(repoPath, rows[parent]?.path ?? "");
      return true;
    }
    return false;
  };

  const current = activeIndex === undefined ? undefined : rows[activeIndex];
  return (
    <FileTreeMenu
      repoId={repoId}
      row={current}
      onOpen={() => {
        activate(current);
      }}
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <VirtualList
          className="flex-1"
          label={label}
          count={rows.length}
          rowHeight={ROW_HEIGHT_PX}
          activeIndex={activeIndex}
          onActiveChange={(index) => {
            const row = rows[index];
            if (!row) return;
            // Like Changed files: moving onto a file shows it.
            if (row.type === "entry" && row.entry.kind !== "folder") show(row);
            else setCursor(repoPath, row.path);
          }}
          onActivate={(index) => {
            activate(rows[index]);
          }}
          onKey={onKey}
          tree={{
            level: (index) => (rows[index]?.depth ?? 0) + 1,
            expanded: (index) => {
              const row = rows[index];
              return row?.type === "entry" && row.entry.kind === "folder"
                ? row.expanded
                : undefined;
            },
          }}
          rowLabel={(index) => {
            const row = rows[index];
            return row ? describeRow(row) : "";
          }}
          renderRow={(index, active) => {
            const row = rows[index];
            return row ? <FileTreeRow row={row} active={active} /> : null;
          }}
        />
      </div>
    </FileTreeMenu>
  );
}
