import { AppWindowIcon } from "lucide-react";

import { STATUS_LABELS, splitPath } from "@/features/changed-files";
import {
  ContextStepper,
  DIFF_LAYOUT_OPTIONS,
  WHITESPACE_OPTIONS,
  useDiffSettings,
} from "@/features/settings";
import type { FileDiffDto, WhitespaceMode } from "@/shared/ipc/bindings";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";

import { useOpenExternalDiff } from "../api/external";
import type { DiffFile } from "../lib/diffFile";
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
      <ContextStepper />
    </div>
  );
}

interface DiffHeaderProps {
  repoId: number;
  file: DiffFile;
  diff: FileDiffDto | undefined;
}

/** File name, folder (or old name), status, line counts, the diff options and the diff tool. */
export function DiffHeader({ repoId, file, diff }: DiffHeaderProps) {
  const { name, folder } = splitPath(file.path);
  const external = useOpenExternalDiff(repoId);
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
        {/* Beside the name, so a narrow pane never pushes it out of view. */}
        {!file.submodule && (
          <Button
            variant="ghost"
            size="icon"
            className="size-6 shrink-0 self-center"
            aria-label="Open in diff tool"
            title="Open in diff tool (Settings → Diff)"
            disabled={external.isPending}
            onClick={() => {
              external.mutate(file);
            }}
          >
            <AppWindowIcon aria-hidden />
          </Button>
        )}
      </div>
      {/* The options change text diffs only (not images, binaries or submodules). */}
      <div className="ml-auto">{diff?.content === "text" && <DiffOptionsBar />}</div>
    </div>
  );
}
