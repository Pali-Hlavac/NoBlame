import { LoaderCircleIcon, type LucideIcon } from "lucide-react";

import { ChangedFileRow, describeFile } from "@/features/changed-files";
import type { WorkingFileDto } from "@/shared/ipc/bindings";
import { VirtualList } from "@/shared/components/VirtualList";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";

/** Height of one row, in CSS pixels. */
const ROW_HEIGHT_PX = 26;

/** What the list's buttons do: "Stage" or "Unstage", with their icons. */
export interface StagingVerb {
  label: string;
  /** Shown while git moves files out of this list, e.g. "Staging…". */
  working: string;
  icon: LucideIcon;
  allIcon: LucideIcon;
}

interface StagingListProps {
  title: string;
  files: readonly WorkingFileDto[];
  /** All the files on this side; the list stops at 5,000. */
  total: number;
  verb: StagingVerb;
  /** Path of the file shown in the diff, when it is in this list. */
  chosen: string | undefined;
  busy: boolean;
  /** Git is moving files out of this list (large working trees can take seconds). */
  working: boolean;
  empty: string;
  onChoose: (file: WorkingFileDto) => void;
  onToggle: (file: WorkingFileDto, index: number) => void;
  onToggleAll: () => void;
}

/**
 * Changed or staged files under a bar with their count and a button that moves all of them.
 * Each row has a button (on hover) that moves the file to the other list; Space does the same
 * for the active row, Enter or a click shows its diff.
 */
export function StagingList(props: StagingListProps) {
  const { files, verb, chosen, busy, onChoose, onToggle } = props;
  const activeIndex = chosen === undefined ? -1 : files.findIndex((file) => file.path === chosen);
  const AllIcon = verb.allIcon;
  const Icon = verb.icon;
  return (
    <section aria-label={props.title} className="flex min-h-24 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-2 py-1 text-xs text-muted-foreground">
        <span className="flex-1 font-medium text-foreground">
          {props.title}{" "}
          <span className="font-normal text-muted-foreground">
            {props.total.toLocaleString()}
            {props.total > files.length && ` (first ${files.length.toLocaleString()} shown)`}
          </span>
        </span>
        {props.working && (
          <span role="status" className="flex items-center gap-1">
            <LoaderCircleIcon className="size-3.5 animate-spin" aria-hidden />
            {verb.working}
          </span>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-1.5 text-xs"
          disabled={busy || props.total === 0}
          onClick={props.onToggleAll}
        >
          <AllIcon aria-hidden />
          {verb.label} all
        </Button>
      </div>
      {files.length === 0 ? (
        <p className="p-3 text-sm text-muted-foreground">{props.empty}</p>
      ) : (
        <VirtualList
          className="flex-1"
          label={props.title}
          count={files.length}
          rowHeight={ROW_HEIGHT_PX}
          activeIndex={activeIndex < 0 ? undefined : activeIndex}
          onActiveChange={(index) => {
            const file = files[index];
            if (file) onChoose(file);
          }}
          onActivate={(index) => {
            const file = files[index];
            if (file) onChoose(file);
          }}
          onKey={(key, index) => {
            const file = index === undefined ? undefined : files[index];
            if (key !== " " || !file || index === undefined || busy) return false;
            onToggle(file, index);
            return true;
          }}
          rowLabel={(index) => {
            const file = files[index];
            return file ? describeFile(file) : "";
          }}
          renderRow={(index, active) => {
            const file = files[index];
            if (!file) return null;
            return (
              <div className="group/row relative h-full">
                <ChangedFileRow file={file} active={active} />
                <Button
                  variant="ghost"
                  size="icon"
                  tabIndex={-1}
                  disabled={busy}
                  aria-label={`${verb.label} ${file.path}`}
                  title={`${verb.label} (Space)`}
                  className={cn(
                    "absolute top-1/2 right-1 size-5 -translate-y-1/2 bg-background/80 opacity-0 group-hover/row:opacity-100",
                    active && "opacity-100",
                  )}
                  onMouseDown={(event) => {
                    // Not a click on the row: that would show the file's diff.
                    event.stopPropagation();
                  }}
                  onClick={() => {
                    onToggle(file, index);
                  }}
                >
                  <Icon aria-hidden />
                </Button>
              </div>
            );
          }}
        />
      )}
    </section>
  );
}
