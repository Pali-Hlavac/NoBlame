import { showFileTab } from "@/features/workspace";
import { VirtualList } from "@/shared/components/VirtualList";

import { SearchXIcon } from "lucide-react";

import { EmptyState } from "@/shared/components/EmptyState";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";

import { useShownRows } from "../hooks/useShownRows";
import { describeRow, parentRow, type TreeRow } from "../lib/rows";
import { useFilesStore } from "../store/files";
import { FileTreeMenu } from "./FileTreeMenu";
import { FileTreeRow } from "./FileTreeRow";

/** Height of one row, in CSS pixels (as in Changed files). */
const ROW_HEIGHT_PX = 26;

interface FileTreeProps {
  repoId: number;
  repoPath: string;
  /** The commit's root folder. */
  rootId: string;
  /** The commit (full id) once known, for Blame. */
  commit: string | undefined;
  /** Accessible name, e.g. "Files at 1a2b3c4d". */
  label: string;
}

/**
 * The folders and files of one commit, folders read as they are opened. Keyboard: arrows move,
 * Right opens a folder (or goes into it), Left closes it (or goes to its folder), Enter opens a
 * folder or shows a file in the file tab.
 */
export function FileTree({ repoId, repoPath, rootId, commit, label }: FileTreeProps) {
  const shown = useShownRows(repoId, rootId, repoPath);
  const { rows, setOpen } = shown;
  const cursor = useFilesStore((state) => state.cursor[repoPath]);
  const found = cursor === undefined ? -1 : rows.findIndex((row) => row.path === cursor);
  const activeIndex = found < 0 ? undefined : found;
  const { setCursor, choose } = useFilesStore.getState();

  const show = (row: TreeRow): void => {
    if (row.type !== "entry") return;
    choose(repoPath, row.path);
    showFileTab();
  };
  /** Enter or a click: a folder opens or closes, anything else is shown in the file tab. */
  const activate = (row: TreeRow | undefined): void => {
    if (row?.type !== "entry") return;
    if (row.entry.kind === "folder") setOpen(row.path, !row.expanded);
    else show(row);
  };
  const onKey = (key: string, index: number | undefined): boolean => {
    const row = index === undefined ? undefined : rows[index];
    if (index === undefined || row?.type !== "entry") return false;
    const folder = row.entry.kind === "folder";
    if (key === "ArrowRight" && folder) {
      const child = rows[index + 1];
      if (!row.expanded) setOpen(row.path, true);
      else if (child && child.depth > row.depth) setCursor(repoPath, child.path);
      return true;
    }
    if (key === "ArrowLeft") {
      const parent = parentRow(rows, index);
      if (folder && row.expanded) setOpen(row.path, false);
      else if (parent !== undefined) setCursor(repoPath, rows[parent]?.path ?? "");
      return true;
    }
    return false;
  };

  if (shown.filtering && rows.length === 0) {
    if (shown.error) {
      return (
        <ErrorState error={shown.error} title="Could not search the files" className="flex-1" />
      );
    }
    if (shown.searching) return <LoadingState label="Searching…" className="flex-1" />;
    return (
      <EmptyState
        icon={SearchXIcon}
        title="No file matches"
        description="Every word must be somewhere in the file's path."
        className="flex-1"
      />
    );
  }

  const current = activeIndex === undefined ? undefined : rows[activeIndex];
  return (
    <FileTreeMenu
      repoId={repoId}
      repoPath={repoPath}
      commit={commit}
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
