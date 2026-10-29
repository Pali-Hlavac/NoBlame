import type { DiffLineKindDto, SyntaxClassDto } from "@/shared/ipc/bindings";
import { cn } from "@/shared/lib/cn";

import { segments } from "../lib/segments";

const CHANGED_CLASSES: Partial<Record<DiffLineKindDto, string>> = {
  added: "rounded-sm bg-diff-added-word",
  removed: "rounded-sm bg-diff-removed-word",
};

const SYNTAX_CLASSES: Readonly<Record<SyntaxClassDto, string>> = {
  comment: "text-syntax-comment italic",
  string: "text-syntax-string",
  keyword: "text-syntax-keyword",
  constant: "text-syntax-constant",
  type: "text-syntax-type",
  function: "text-syntax-function",
  tag: "text-syntax-tag",
  attribute: "text-syntax-attribute",
};

interface LineTextProps {
  text: string;
  kind: DiffLineKindDto;
  /** Changed words, `[start, end)` in UTF-16 offsets. */
  highlights: readonly (readonly [number, number])[];
  /** Syntax colours, `[start, end, class]` in UTF-16 offsets. */
  syntax: readonly (readonly [number, number, SyntaxClassDto])[];
}

/** The text of a line with its syntax colours and changed words (marked for screen readers). */
export function LineText({ text, kind, highlights, syntax }: LineTextProps) {
  if (highlights.length === 0 && syntax.length === 0) return <>{text}</>;
  return (
    <>
      {segments(text, highlights, syntax).map((part, index) => {
        const colour = part.syntax && SYNTAX_CLASSES[part.syntax];
        return part.changed ? (
          <mark key={index} className={cn("text-inherit", CHANGED_CLASSES[kind], colour)}>
            {part.text}
          </mark>
        ) : (
          <span key={index} className={colour}>
            {part.text}
          </span>
        );
      })}
    </>
  );
}
