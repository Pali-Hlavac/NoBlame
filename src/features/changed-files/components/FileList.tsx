import type { ReactNode } from "react";

import { selectFile, useSelectedFile } from "@/features/selection";
import { showDiffTab } from "@/features/workspace";
import { VirtualList } from "@/shared/components/VirtualList";

import { describeFile, type ListedFile } from "../lib/files";
import { ChangedFileRow } from "./ChangedFileRow";

/** Height of one row, in CSS pixels. */
const ROW_HEIGHT_PX = 26;

interface FileListProps {
  repoPath: string;
  files: readonly ListedFile[];
  /** The bar above the list (counts, options). */
  header: ReactNode;
  /** Said when there are no files. */
  empty: string;
}

/** A list of files under a bar; choosing one shows its diff in the diff tab. */
export function FileList({ repoPath, files, header, empty }: FileListProps) {
  const chosen = useSelectedFile(repoPath);
  const activeIndex = chosen === undefined ? -1 : files.findIndex((file) => file.path === chosen);
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
      )}
    </div>
  );
}
