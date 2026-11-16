import type { ReactNode } from "react";

import { FileContextMenu, type MenuAction, type MenuFile } from "@/features/file-menu";
import { selectFile, useSelectedFile } from "@/features/selection";
import { showDiffTab } from "@/features/workspace";
import { VirtualList } from "@/shared/components/VirtualList";

import { describeFile, type ListedFile } from "../lib/files";
import { ChangedFileRow } from "./ChangedFileRow";

/** Height of one row, in CSS pixels. */
const ROW_HEIGHT_PX = 26;

interface FileListProps<F extends ListedFile> {
  repoId: number;
  repoPath: string;
  files: readonly F[];
  /** The bar above the list (counts, options). */
  header: ReactNode;
  /** Said when there are no files. */
  empty: string;
  /** A file as its context menu needs it (the version to save, the commit to blame). */
  menuFile: (file: F) => MenuFile;
  /** More of the menu's actions for a file, after **Show diff**. */
  moreActions?: (file: F) => MenuAction[];
}

/**
 * A list of files under a bar; choosing one shows its diff in the diff tab. Each file has a
 * context menu (`FileContextMenu`).
 */
export function FileList<F extends ListedFile>(props: FileListProps<F>) {
  const { repoId, repoPath, files, header, empty } = props;
  const chosen = useSelectedFile(repoPath);
  const activeIndex = chosen === undefined ? -1 : files.findIndex((file) => file.path === chosen);
  const current = activeIndex < 0 ? undefined : files[activeIndex];
  const choose = (file: ListedFile | undefined): void => {
    if (!file) return;
    selectFile(repoPath, file.path);
    showDiffTab();
  };
  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-2 py-1 text-xs text-muted-foreground">
        {header}
      </div>
      {files.length === 0 ? (
        <p className="p-3 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <FileContextMenu
          repoId={repoId}
          repoPath={repoPath}
          file={current && props.menuFile(current)}
          actions={[
            {
              label: "Show diff",
              onSelect: () => {
                choose(current);
              },
            },
            ...(current && props.moreActions ? props.moreActions(current) : []),
          ]}
        >
          <div className="flex min-h-0 flex-1 flex-col">
            <VirtualList
              className="flex-1"
              label="Changed files"
              count={files.length}
              rowHeight={ROW_HEIGHT_PX}
              activeIndex={activeIndex < 0 ? undefined : activeIndex}
              onActiveChange={(index) => {
                choose(files[index]);
              }}
              onActivate={(index) => {
                choose(files[index]);
              }}
              rowLabel={(index) => {
                const file = files[index];
                return file ? describeFile(file) : "";
              }}
              renderRow={(index, active) => {
                const file = files[index];
                return file ? <ChangedFileRow file={file} active={active} /> : null;
              }}
            />
          </div>
        </FileContextMenu>
      )}
    </div>
  );
}
