import { STATUS_LABELS, splitPath } from "@/features/changed-files";
import {
  CONTEXT_OPTIONS,
  DIFF_LAYOUT_OPTIONS,
  WHITESPACE_OPTIONS,
  contextLines,
  contextValue,
  useDiffSettings,
} from "@/features/settings";
import type { ChangedFileDto, FileDiffDto, WhitespaceMode } from "@/shared/ipc/bindings";
import { cn } from "@/shared/lib/cn";

import { formatChangeCounts } from "../lib/format";

const SELECT_CLASSES =
  "max-w-48 rounded border border-border bg-background px-1 py-0.5 text-xs focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

/** Layout, whitespace and context of every diff (saved in the settings). */
function DiffOptionsBar() {
  const [settings, change] = useDiffSettings();
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <div
        role="group"
        aria-label="Layout"
        className="flex overflow-hidden rounded border border-border"
      >
        {DIFF_LAYOUT_OPTIONS.map((option) => {
          const pressed = settings.layout === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={pressed}
              className={cn(
                "px-2 py-0.5 text-xs focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset",
                pressed
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
              onClick={() => {
                change({ layout: option.value });
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <select
        aria-label="Whitespace"
        className={SELECT_CLASSES}
        value={settings.whitespace}
        onChange={(event) => {
          change({ whitespace: event.target.value as WhitespaceMode });
        }}
      >
        {WHITESPACE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value} title={option.label}>
            {option.short}
          </option>
        ))}
      </select>
      <select
        aria-label="Unchanged lines around each change"
        className={SELECT_CLASSES}
        value={contextValue(settings.contextLines)}
        onChange={(event) => {
          change({ contextLines: contextLines(event.target.value) });
        }}
      >
        {CONTEXT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.short}
          </option>
        ))}
      </select>
    </div>
  );
}

/** File name, folder (or old name), status, line counts and the diff options. */
export function DiffHeader({
  file,
  diff,
}: {
  file: ChangedFileDto;
  diff: FileDiffDto | undefined;
}) {
  const { name, folder } = splitPath(file.path);
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-border px-3 py-1.5 text-sm">
      <div className="flex min-w-0 items-baseline gap-2">
        <span className="font-medium">{name}</span>
        <span className="min-w-0 truncate text-xs text-muted-foreground">
          {file.previousPath
            ? `${STATUS_LABELS[file.status].word} from ${file.previousPath}`
            : folder}
        </span>
        <span className="text-xs text-muted-foreground">
          {!file.previousPath && STATUS_LABELS[file.status].word}
        </span>
        {diff?.content === "text" && diff.rows > 0 && (
          <span className="font-mono text-xs text-muted-foreground">
            {formatChangeCounts(diff.additions, diff.deletions)}
          </span>
        )}
      </div>
      {/* The options change text diffs only (not images, binaries or submodules). */}
      <div className="ml-auto">{diff?.content === "text" && <DiffOptionsBar />}</div>
    </div>
  );
}
