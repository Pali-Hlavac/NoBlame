import { EyeOffIcon, Undo2Icon } from "lucide-react";
import type { MouseEvent } from "react";

import { ChangedFileRow } from "@/features/changed-files";
import type { WorkingFileDto } from "@/shared/ipc/bindings";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";

import { canDiscard } from "../lib/discard";
import type { StagingVerb } from "./StagingList";

/** A row's small button, shown on hover and on the active row. */
const ROW_BUTTON_CLASSES = "size-5 bg-background/80";

/** A press on a row's button is not a press on the row (that would show the file's diff). */
function stopRowPress(event: MouseEvent): void {
  event.stopPropagation();
}

interface StagingRowProps {
  file: WorkingFileDto;
  active: boolean;
  verb: StagingVerb;
  busy: boolean;
  onToggle: () => void;
  onDiscard?: (file: WorkingFileDto) => void;
  onIgnore?: (file: WorkingFileDto) => void;
}

/** A file in the Commit module's lists, with its buttons (on hover and on the active row). */
export function StagingRow(props: StagingRowProps) {
  const { file, active, verb, busy, onToggle } = props;
  const Icon = verb.icon;
  return (
    <div className="group/row relative h-full">
      <ChangedFileRow file={file} active={active} />
      <span
        className={cn(
          "absolute top-1/2 right-1 flex -translate-y-1/2 gap-0.5 opacity-0 group-hover/row:opacity-100",
          active && "opacity-100",
        )}
      >
        {props.onIgnore && file.status === "untracked" && (
          <Button
            variant="ghost"
            size="icon"
            tabIndex={-1}
            disabled={busy}
            aria-label={`Ignore ${file.path}…`}
            title="Ignore (add to .gitignore)…"
            className={ROW_BUTTON_CLASSES}
            onMouseDown={stopRowPress}
            onClick={() => {
              props.onIgnore?.(file);
            }}
          >
            <EyeOffIcon aria-hidden />
          </Button>
        )}
        {props.onDiscard && canDiscard(file) && (
          <Button
            variant="ghost"
            size="icon"
            tabIndex={-1}
            disabled={busy}
            aria-label={`Discard ${file.path}…`}
            title="Discard the changes…"
            className={ROW_BUTTON_CLASSES}
            onMouseDown={stopRowPress}
            onClick={() => {
              props.onDiscard?.(file);
            }}
          >
            <Undo2Icon aria-hidden />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          tabIndex={-1}
          disabled={busy}
          aria-label={`${verb.label} ${file.path}`}
          title={`${verb.label} (Space)`}
          className={ROW_BUTTON_CLASSES}
          onMouseDown={stopRowPress}
          onClick={() => {
            onToggle();
          }}
        >
          <Icon aria-hidden />
        </Button>
      </span>
    </div>
  );
}
