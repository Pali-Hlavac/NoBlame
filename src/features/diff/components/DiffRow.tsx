import type { DiffLineDto } from "@/shared/ipc/bindings";
import { cn } from "@/shared/lib/cn";

import {
  GUTTER_CLASSES,
  LINE_CLASSES,
  MARKERS,
  SELECTABLE,
  SPOKEN,
  TRUNCATED_NOTE,
} from "../lib/rowStyles";
import { LineText } from "./LineText";

interface DiffRowProps {
  /** `undefined` while its page loads. */
  line: DiffLineDto | undefined;
  /** Width of each line-number column, in characters. */
  digits: number;
}

/** One unified row: old and new line numbers, the +/- marker, and the text. */
export function DiffRow({ line, digits }: DiffRowProps) {
  if (!line) return null;
  const number = { width: `${digits}ch` };
  return (
    <div className={cn("flex h-full w-max min-w-full", LINE_CLASSES[line.kind])}>
      <span
        aria-hidden
        className={cn(
          "sticky left-0 flex shrink-0 gap-2 border-r border-border px-2 text-right text-muted-foreground select-none",
          GUTTER_CLASSES[line.kind],
        )}
      >
        <span style={number}>{line.oldLine ?? ""}</span>
        <span style={number}>{line.newLine ?? ""}</span>
      </span>
      {/* Not selectable, so copied text has no + and - (screen readers hear "added:"). */}
      <span className="w-5 shrink-0 text-center select-none">
        <span aria-hidden>{MARKERS[line.kind]}</span>
        <span className="sr-only">{SPOKEN[line.kind]}</span>
      </span>
      <span className={cn("pr-4 whitespace-pre", SELECTABLE[line.kind] && "select-text")}>
        {line.kind === "noNewline" ? (
          "No newline at end of file"
        ) : (
          <LineText
            text={line.text}
            kind={line.kind}
            highlights={line.highlights}
            syntax={line.syntax}
          />
        )}
        {line.truncated && (
          <span className="pl-2 text-muted-foreground italic select-none">{TRUNCATED_NOTE}</span>
        )}
      </span>
    </div>
  );
}
