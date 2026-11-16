import { type KeyboardEvent, useState } from "react";

/** Rows while the box has focus or text: at least, and at most before it scrolls. */
const MIN_ROWS = 3;
const MAX_ROWS = 10;

interface MessageBoxProps {
  id: string;
  value: string;
  describedBy: string | undefined;
  onChange: (value: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
}

/**
 * The commit message box: one line while empty and not in use, so the lists keep the height;
 * it grows with the message (3 to 10 lines) and can be dragged taller.
 */
export function MessageBox({ id, value, describedBy, onChange, onKeyDown }: MessageBoxProps) {
  const [focused, setFocused] = useState(false);
  const lines = value.split("\n").length;
  const rows = !focused && value === "" ? 1 : Math.min(MAX_ROWS, Math.max(MIN_ROWS, lines + 1));
  return (
    <textarea
      id={id}
      value={value}
      placeholder="Commit message"
      rows={rows}
      spellCheck
      aria-describedby={describedBy}
      className="min-h-8 resize-y rounded-md border border-border bg-background px-2 py-1.5 font-mono text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
      onFocus={() => {
        setFocused(true);
      }}
      onBlur={() => {
        setFocused(false);
      }}
      onChange={(event) => {
        onChange(event.target.value);
      }}
      onKeyDown={onKeyDown}
    />
  );
}
