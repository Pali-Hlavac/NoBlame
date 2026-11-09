import { LoaderCircleIcon, Undo2Icon, type LucideIcon } from "lucide-react";

import { describeFile } from "@/features/changed-files";
import type { WorkingFileDto } from "@/shared/ipc/bindings";
import { VirtualList } from "@/shared/components/VirtualList";
import { Button } from "@/shared/ui/button";

import { StagingMenu } from "./StagingMenu";
import { StagingRow } from "./StagingRow";

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
  repoId: number;
  repoPath: string;
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
  /** Throws away a file's changes (after asking); the Changes list only. */
  onDiscard?: (file: WorkingFileDto) => void;
  /** Throws away every listed change (after asking). */
  onDiscardAll?: () => void;
  /** Adds an untracked file to an ignore file (after asking how). */
  onIgnore?: (file: WorkingFileDto) => void;
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
        {props.onDiscardAll && (
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            aria-label="Discard all changes…"
            title="Discard all changes…"
            disabled={busy || props.total === 0}
            onClick={props.onDiscardAll}
          >
            <Undo2Icon aria-hidden />
          </Button>
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
        <StagingMenu
          repoId={props.repoId}
          repoPath={props.repoPath}
          file={files[activeIndex]}
          index={activeIndex}
          verb={verb.label}
          busy={busy}
          onChoose={onChoose}
          onToggle={onToggle}
          onDiscard={props.onDiscard}
          onIgnore={props.onIgnore}
        >
          <div className="flex min-h-0 flex-1 flex-col">
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
                  <StagingRow
                    file={file}
                    active={active}
                    verb={verb}
                    busy={busy}
                    onToggle={() => {
                      onToggle(file, index);
                    }}
                    onDiscard={props.onDiscard}
                    onIgnore={props.onIgnore}
                  />
                );
              }}
            />
          </div>
        </StagingMenu>
      )}
    </section>
  );
}
