import { useState } from "react";

import type { ChunkSourceDto } from "@/shared/ipc/bindings";
import { cn } from "@/shared/lib/cn";

import { shownText } from "../lib/mergeView";
import { Lines } from "./MergeText";

/** Unchanged lines shown around a folded run of them. */
const CONTEXT_LINES = 3;

const SOURCE: Readonly<Record<ChunkSourceDto, { label: string; className: string }>> = {
  unchanged: { label: "Unchanged", className: "border-l-4 border-l-transparent" },
  ours: { label: "Changed only by ours", className: "border-l-4 border-l-merge-ours" },
  theirs: { label: "Changed only by theirs", className: "border-l-4 border-l-merge-theirs" },
  both: { label: "Changed the same way by both", className: "border-l-4 border-l-merge-both" },
};

interface ResolvedChunkProps {
  source: ChunkSourceDto;
  text: string;
}

/**
 * Lines the merge decided by itself, marked by who changed them. Long runs of unchanged lines
 * are folded, with a button to show them.
 */
export function ResolvedChunk({ source, text }: ResolvedChunkProps) {
  const [open, setOpen] = useState(false);
  const { label, className } = SOURCE[source];
  const lines = shownText(text).split("\n");
  const folded = source === "unchanged" && !open && lines.length > CONTEXT_LINES * 2 + 1;
  if (!folded) {
    return (
      <div className={className} title={label}>
        <span className="sr-only">{label}:</span>
        <Lines text={text} className="py-0" />
      </div>
    );
  }
  const hidden = lines.length - CONTEXT_LINES * 2;
  return (
    <div className={cn(className, "py-0")}>
      <Lines text={lines.slice(0, CONTEXT_LINES).join("\n")} className="py-0" />
      <button
        type="button"
        className="mx-3 my-0.5 rounded-sm px-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        onClick={() => {
          setOpen(true);
        }}
      >
        Show {hidden} unchanged lines
      </button>
      <Lines text={lines.slice(-CONTEXT_LINES).join("\n")} className="py-0" />
    </div>
  );
}
