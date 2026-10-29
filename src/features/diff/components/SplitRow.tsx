import type { SplitCellDto, SplitLineDto } from "@/shared/ipc/bindings";
import { cn } from "@/shared/lib/cn";

import { LINE_CLASSES, MARKERS, SPOKEN, TRUNCATED_NOTE } from "../lib/rowStyles";

/**
 * Both halves scroll sideways together: the text moves by `--diff-scroll-x`, which the
 * side-by-side view sets on its scrolling element (no re-render while scrolling).
 */
const SHIFTED = { transform: "translateX(calc(-1 * var(--diff-scroll-x, 0px)))" } as const;

interface HalfProps {
  cell: SplitCellDto | null;
  digits: number;
  className?: string;
}

function Half({ cell, digits, className }: HalfProps) {
  if (!cell) return <div className={cn("h-full bg-muted/40", className)} />;
  return (
    <div className={cn("flex h-full min-w-0", LINE_CLASSES[cell.kind], className)}>
      <span
        aria-hidden
        className="shrink-0 border-r border-border px-2 text-right text-muted-foreground select-none"
      >
        <span className="inline-block" style={{ width: `${digits}ch` }}>
          {cell.line}
        </span>
      </span>
      <span aria-hidden className="w-5 shrink-0 text-center select-none">
        {MARKERS[cell.kind]}
      </span>
      <span className="min-w-0 flex-1 overflow-hidden">
        <span className="block pr-4 whitespace-pre" style={SHIFTED}>
          <span className="sr-only">{SPOKEN[cell.kind]}</span>
          {cell.text}
          {cell.truncated && (
            <span className="pl-2 text-muted-foreground italic">{TRUNCATED_NOTE}</span>
          )}
          {cell.noNewline && (
            <span className="pl-2 text-muted-foreground italic">(no newline at end of file)</span>
          )}
        </span>
      </span>
    </div>
  );
}

interface SplitRowProps {
  /** `undefined` while its page loads. */
  line: SplitLineDto | undefined;
  /** Width of the line-number column, in characters. */
  digits: number;
}

/** One side-by-side row: a hunk header across both halves, or the old and the new line. */
export function SplitRow({ line, digits }: SplitRowProps) {
  if (!line) return null;
  if (line.hunk !== null) {
    return (
      <div className={cn("flex h-full items-center px-2", LINE_CLASSES.hunk)}>{line.hunk}</div>
    );
  }
  return (
    <div className="grid h-full grid-cols-2">
      <Half cell={line.left} digits={digits} className="border-r border-border" />
      <Half cell={line.right} digits={digits} />
    </div>
  );
}
