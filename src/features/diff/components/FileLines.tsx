import { useRef } from "react";

import { InlineError } from "@/shared/components/InlineError";
import type { DiffLineDto, FileDiffDto } from "@/shared/ipc/bindings";

import { useFileViewPages, type FileViewRequest } from "../api/view";
import { rowAt, useVirtualRows } from "../hooks/useVirtualRows";
import { MAX_SHOWN_ROWS, ROW_HEIGHT_PX } from "../lib/constants";
import { gutterDigits } from "../lib/format";
import { REGION_CLASSES } from "../lib/region";
import { TRUNCATED_NOTE } from "../lib/rowStyles";
import { LineText } from "./LineText";

const counts = new Intl.NumberFormat("en-US");

/** One line of the file: its number and its text. */
function FileRow({ line, digits }: { line: DiffLineDto | undefined; digits: number }) {
  if (!line) return null;
  if (line.kind === "noNewline") {
    return (
      <div className="flex h-full w-max min-w-full text-muted-foreground italic select-none">
        <span className="sticky left-0 shrink-0 border-r border-border bg-background px-2">
          <span className="inline-block" style={{ width: `${digits}ch` }} />
        </span>
        <span className="pl-3">No newline at end of file</span>
      </div>
    );
  }
  return (
    <div className="flex h-full w-max min-w-full">
      <span
        aria-hidden
        className="sticky left-0 shrink-0 border-r border-border bg-background px-2 text-right text-muted-foreground select-none"
      >
        <span className="inline-block" style={{ width: `${digits}ch` }}>
          {line.newLine ?? ""}
        </span>
      </span>
      <span className="pr-4 pl-3 whitespace-pre select-text">
        <LineText text={line.text} kind="context" highlights={[]} syntax={line.syntax} />
        {line.truncated && (
          <span className="pl-2 text-muted-foreground italic select-none">{TRUNCATED_NOTE}</span>
        )}
      </span>
    </div>
  );
}

interface FileLinesProps {
  request: FileViewRequest;
  view: FileDiffDto;
  /** Accessible name of the scrolling region, e.g. "src/main.rs at 1a2b3c4d". */
  label: string;
}

/**
 * A file's lines, virtualized like the diff: only the rows on screen are rendered, and their
 * text is fetched in pages. Focus it to scroll with the keyboard.
 */
export function FileLines({ request, view, label }: FileLinesProps) {
  const viewport = useRef<HTMLDivElement>(null);
  const count = Math.min(view.rows, MAX_SHOWN_ROWS);
  const { first, last, pages, onScroll } = useVirtualRows(viewport, count);
  const results = useFileViewPages(request, pages);
  const failed = results.find((result) => result.error)?.error;
  const digits = gutterDigits(0, view.newLines);

  const rows = [];
  for (let index = first; index <= last; index++) {
    rows.push(
      <div
        key={index}
        className="absolute left-0 min-w-full"
        style={{ top: index * ROW_HEIGHT_PX, height: ROW_HEIGHT_PX }}
      >
        <FileRow line={rowAt(results, pages, index)} digits={digits} />
      </div>,
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {failed !== undefined && <InlineError error={failed} className="m-2" />}
      <div
        ref={viewport}
        role="region"
        aria-label={label}
        // A scrolling region must take focus so the keyboard can scroll it (WCAG 2.1.1).
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
        className={`${REGION_CLASSES} overflow-auto`}
        onScroll={onScroll}
      >
        <div style={{ height: count * ROW_HEIGHT_PX }}>{rows}</div>
      </div>
      {view.rows > count && (
        <p className="shrink-0 border-t border-border px-3 py-1 text-xs text-muted-foreground">
          Showing the first {counts.format(count)} of {counts.format(view.rows)} lines.
        </p>
      )}
    </div>
  );
}
