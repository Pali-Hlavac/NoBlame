import type { DiffLineDto, DiffLineKindDto } from "@/shared/ipc/bindings";
import { cn } from "@/shared/lib/cn";

const ROW_CLASSES: Readonly<Record<DiffLineKindDto, string>> = {
  hunk: "bg-diff-hunk text-muted-foreground",
  context: "",
  added: "bg-diff-added",
  removed: "bg-diff-removed",
  noNewline: "text-muted-foreground italic",
};

/** The line numbers stay put while scrolling sideways, so they need an opaque background. */
const GUTTER_CLASSES: Readonly<Record<DiffLineKindDto, string>> = {
  hunk: "bg-diff-hunk",
  context: "bg-background",
  added: "bg-diff-added",
  removed: "bg-diff-removed",
  noNewline: "bg-background",
};

const MARKERS: Readonly<Record<DiffLineKindDto, string>> = {
  hunk: "",
  context: "",
  added: "+",
  removed: "-",
  noNewline: "",
};

/** Read by screen readers instead of the + and - markers. */
const SPOKEN: Readonly<Record<DiffLineKindDto, string>> = {
  hunk: "",
  context: "",
  added: "added: ",
  removed: "removed: ",
  noNewline: "",
};

interface DiffRowProps {
  /** `undefined` while its page loads. */
  line: DiffLineDto | undefined;
  /** Width of each line-number column, in characters. */
  digits: number;
}

/** One row: old and new line numbers, the +/- marker, and the text. */
export function DiffRow({ line, digits }: DiffRowProps) {
  if (!line) return null;
  const number = { width: `${digits}ch` };
  return (
    <div className={cn("flex h-full w-max min-w-full", ROW_CLASSES[line.kind])}>
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
      <span aria-hidden className="w-5 shrink-0 text-center select-none">
        {MARKERS[line.kind]}
      </span>
      <span className="pr-4 whitespace-pre">
        <span className="sr-only">{SPOKEN[line.kind]}</span>
        {line.kind === "noNewline" ? "No newline at end of file" : line.text}
        {line.truncated && (
          <span className="pl-2 text-muted-foreground italic">… line cut at 4,096 bytes</span>
        )}
      </span>
    </div>
  );
}
