import type { DiffLineKindDto } from "@/shared/ipc/bindings";
import { cn } from "@/shared/lib/cn";

import { segments } from "../lib/segments";

const CHANGED_CLASSES: Partial<Record<DiffLineKindDto, string>> = {
  added: "rounded-sm bg-diff-added-word",
  removed: "rounded-sm bg-diff-removed-word",
};

interface LineTextProps {
  text: string;
  kind: DiffLineKindDto;
  /** Changed words, `[start, end)` in UTF-16 offsets. */
  highlights: readonly (readonly [number, number])[];
}

/** The text of a line, with its changed words marked (for screen readers too). */
export function LineText({ text, kind, highlights }: LineTextProps) {
  if (highlights.length === 0) return <>{text}</>;
  return (
    <>
      {segments(text, highlights).map((part, index) =>
        part.changed ? (
          <mark key={index} className={cn("text-inherit", CHANGED_CLASSES[kind])}>
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </>
  );
}
