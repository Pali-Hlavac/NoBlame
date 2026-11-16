import { LoaderCircleIcon, Undo2Icon } from "lucide-react";

import type { WorkingFileDto } from "@/shared/ipc/bindings";
import { Button } from "@/shared/ui/button";

import type { StagingVerb } from "../lib/verbs";
import { StagingFiles } from "./StagingFiles";

interface StagingListProps {
  repoId: number;
  repoPath: string;
  title: string;
  files: readonly WorkingFileDto[];
  /** All the files on this side; the list stops at 5,000. */
  total: number;
  verb: StagingVerb;
  /** Rows show the folder before the name (Settings → Commit). */
  pathFirst: boolean;
  /** Path of the file shown in the diff, when it is in this list. */
  chosen: string | undefined;
  busy: boolean;
  /** Git is moving files out of this list (large working trees can take seconds). */
  working: boolean;
  empty: string;
  onChoose: (file: WorkingFileDto) => void;
  /** Stages or unstages these files (one, or the chosen ones). */
  onToggle: (files: WorkingFileDto[]) => void;
  onToggleAll: () => void;
  /** Throws these files' changes away (after asking); the Changes list only. */
  onDiscard?: (files: WorkingFileDto[]) => void;
  /** Throws away every listed change (after asking). */
  onDiscardAll?: () => void;
  /** Adds an untracked file to an ignore file (after asking how). */
  onIgnore?: (file: WorkingFileDto) => void;
}

/**
 * Changed or staged files under a bar with their count and a button that moves all of them.
 * Each row has a button (on hover) that moves the file to the other list; Space does the same
 * for the chosen files, Enter or a click shows its diff (see `StagingFiles`).
 */
export function StagingList(props: StagingListProps) {
  const { files, verb, busy } = props;
  const AllIcon = verb.allIcon;
  return (
    <section aria-label={props.title} className="flex h-full min-h-0 flex-col">
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
        <StagingFiles
          repoId={props.repoId}
          repoPath={props.repoPath}
          title={props.title}
          files={files}
          verb={verb}
          pathFirst={props.pathFirst}
          chosen={props.chosen}
          busy={busy}
          onChoose={props.onChoose}
          onToggle={props.onToggle}
          onDiscard={props.onDiscard}
          onIgnore={props.onIgnore}
        />
      )}
    </section>
  );
}
