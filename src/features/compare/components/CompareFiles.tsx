import { EqualIcon, MousePointerClickIcon } from "lucide-react";
import { Group, Panel, Separator } from "react-resizable-panels";

import { ChangedFileRow, describeFile } from "@/features/changed-files";
import { DiskFileDiff, FileDiffView } from "@/features/diff";
import { FileContextMenu } from "@/features/file-menu";
import { EmptyState } from "@/shared/components/EmptyState";
import { VirtualList } from "@/shared/components/VirtualList";
import type { ComparisonDto } from "@/shared/ipc/bindings";

import { chooseComparedFile, useComparedFile } from "../store/compare";

/** Height of one row, in CSS pixels (as in Changed files). */
const ROW_HEIGHT_PX = 26;
/** Panels sized by the layout must not scroll themselves (fractional display scaling). */
const PANEL_STYLE = { overflow: "hidden" } as const;

interface CompareFilesProps {
  repoId: number;
  repoPath: string;
  result: ComparisonDto;
}

/** The files that differ beside the diff of the chosen one. */
export function CompareFiles({ repoId, repoPath, result }: CompareFilesProps) {
  const chosen = useComparedFile(repoPath);
  const { files } = result;
  if (files.length === 0) {
    return (
      <EmptyState
        icon={EqualIcon}
        title="No differences"
        description={
          result.mergeBase
            ? "The second side changed nothing since the two split."
            : "Both revisions have exactly the same files."
        }
        className="flex-1"
      />
    );
  }
  const activeIndex = chosen === undefined ? -1 : files.findIndex((file) => file.path === chosen);
  const file = files[activeIndex];
  const choose = (index: number): void => {
    const next = files[index];
    if (next) chooseComparedFile(repoPath, next.path);
  };
  return (
    <Group orientation="horizontal" className="min-h-0 flex-1">
      <Panel id="compare-files" defaultSize="35%" minSize="160px" style={PANEL_STYLE}>
        <FileContextMenu
          repoId={repoId}
          repoPath={repoPath}
          file={
            file && {
              path: file.path,
              // Compared with the working tree, the new side is the file on disk.
              blobId: file.newId ?? file.oldId,
              commit: result.worktree || file.status === "deleted" ? undefined : result.target.id,
            }
          }
          actions={[
            {
              label: "Show diff",
              onSelect: () => {
                choose(activeIndex);
              },
            },
          ]}
        >
          <div className="h-full">
            <VirtualList
              className="h-full"
              label="Files that differ"
              count={files.length}
              rowHeight={ROW_HEIGHT_PX}
              activeIndex={activeIndex < 0 ? undefined : activeIndex}
              onActiveChange={choose}
              onActivate={choose}
              rowLabel={(index) => {
                const row = files[index];
                return row ? describeFile(row) : "";
              }}
              renderRow={(index, active) => {
                const row = files[index];
                return row ? <ChangedFileRow file={row} active={active} /> : null;
              }}
            />
          </div>
        </FileContextMenu>
      </Panel>
      <Separator
        aria-label="Resize the file list"
        className="w-px bg-border outline-none hover:bg-primary focus-visible:bg-ring data-[separator=active]:bg-primary"
      />
      <Panel id="compare-diff" minSize="200px" style={PANEL_STYLE}>
        {file && result.worktree && file.status !== "deleted" ? (
          <DiskFileDiff key={file.path} repoId={repoId} file={file} />
        ) : file ? (
          <FileDiffView repoId={repoId} file={file} />
        ) : (
          <EmptyState
            icon={MousePointerClickIcon}
            title="No file chosen"
            description="Choose a file to see how it differs."
            className="h-full"
          />
        )}
      </Panel>
    </Group>
  );
}
