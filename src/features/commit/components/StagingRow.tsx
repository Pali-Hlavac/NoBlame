import { EyeOffIcon, Undo2Icon } from "lucide-react";
import type { MouseEvent } from "react";

import { ChangedFileRow } from "@/features/changed-files";
import type { WorkingFileDto } from "@/shared/ipc/bindings";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";

import { canDiscard } from "../lib/discard";
import type { StagingVerb } from "../lib/verbs";

/** A row's small button, shown on hover and on the active row. */
const ROW_BUTTON_CLASSES = "size-5 bg-background/80";

/**
 * A press on a row's button is not a press on the row (that would show the file's diff), and
 * leaves the keyboard with the list.
 */
function stopRowPress(event: MouseEvent): void {
  event.stopPropagation();
  event.preventDefault();
}

interface StagingRowProps {
  file: WorkingFileDto;
  /** The list's cursor: its file's diff shows. */
  active: boolean;
  /** Chosen (one of the files the list's actions take). */
  selected: boolean;
  /** Several files are chosen: the cursor is outlined so it stands out among them. */
  many: boolean;
  /** How many files the row's buttons act on (all chosen ones when it is one of them). */
  count: number;
  /** The folder before the name (Settings → Commit). */
  pathFirst: boolean;
  verb: StagingVerb;
  busy: boolean;
  onToggle: () => void;
  onDiscard?: () => void;
  onIgnore?: () => void;
}

/** A file in the Commit module's lists, with its buttons (on hover and on the active row). */
export function StagingRow(props: StagingRowProps) {
  const { file, active, verb, busy, count } = props;
  const Icon = verb.icon;
  const what = count > 1 ? `${count.toLocaleString()} files` : file.path;
  return (
    <div
      className={cn(
        "group/row relative h-full",
        active && props.many && "outline outline-1 -outline-offset-1 outline-ring",
      )}
    >
      <ChangedFileRow file={file} active={props.selected} pathFirst={props.pathFirst} />
      {/* For the mouse: the keyboard has Space and the list's menu, and the row's name says
          the rest (a list option must not hold controls of its own). */}
      <span
        aria-hidden
        className={cn(
          "absolute top-1/2 right-1 flex -translate-y-1/2 gap-0.5 opacity-0 group-hover/row:opacity-100",
          active && "opacity-100",
        )}
      >
        {props.onIgnore && count === 1 && file.status === "untracked" && (
          <Button
            variant="ghost"
            size="icon"
            tabIndex={-1}
            disabled={busy}
            aria-label={`Ignore ${file.path}…`}
            title="Ignore (add to .gitignore)…"
            className={ROW_BUTTON_CLASSES}
            onMouseDown={stopRowPress}
            onClick={props.onIgnore}
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
            aria-label={`Discard ${what}…`}
            title="Discard the changes…"
            className={ROW_BUTTON_CLASSES}
            onMouseDown={stopRowPress}
            onClick={props.onDiscard}
          >
            <Undo2Icon aria-hidden />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          tabIndex={-1}
          disabled={busy}
          aria-label={`${verb.label} ${what}`}
          title={`${verb.label} (Space)`}
          className={ROW_BUTTON_CLASSES}
          onMouseDown={stopRowPress}
          onClick={props.onToggle}
        >
          <Icon aria-hidden />
        </Button>
      </span>
    </div>
  );
}
