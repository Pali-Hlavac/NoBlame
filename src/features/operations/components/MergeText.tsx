import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/cn";

import { lineCount, shownText } from "../lib/mergeView";

/** The editor grows with the text up to this many rows. */
const MAX_EDITOR_ROWS = 24;

/** Lines in a block; an empty text says so. */
export function Lines({ text, className }: { text: string; className?: string }) {
  if (text === "") {
    return <p className="px-3 py-1 text-xs text-muted-foreground italic">No lines</p>;
  }
  return (
    <pre className={cn("overflow-x-auto px-3 py-1 font-mono text-xs leading-5", className)}>
      {shownText(text)}
    </pre>
  );
}

export interface EditorProps {
  text: string;
  label: string;
  onChange: (text: string) => void;
  onDone: () => void;
  onCancel: () => void;
}

/** Lines being edited, with Done and Cancel (Escape). */
export function Editor({ text, label, onChange, onDone, onCancel }: EditorProps) {
  return (
    <div className="flex flex-col gap-1 p-2">
      <textarea
        aria-label={label}
        // eslint-disable-next-line jsx-a11y/no-autofocus -- the user just chose to edit these lines
        autoFocus
        spellCheck={false}
        value={text}
        rows={Math.min(MAX_EDITOR_ROWS, lineCount(text) + 1)}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            onCancel();
          }
        }}
        className="border-input w-full resize-y rounded-md border bg-background px-2 py-1 font-mono text-xs leading-5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <div className="flex justify-end gap-1">
        <Button size="sm" variant="ghost" className="h-7" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" className="h-7" onClick={onDone}>
          Done
        </Button>
      </div>
    </div>
  );
}
