import { HistoryIcon, RefreshCwIcon } from "lucide-react";
import { useState } from "react";

import { formatCommitDate, formatRelativeDate, shortId } from "@/features/graph";
import { WithActiveRepository, useActiveRepository } from "@/features/repositories";
import { EmptyState } from "@/shared/components/EmptyState";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";
import { VirtualList } from "@/shared/components/VirtualList";
import { useNow } from "@/shared/hooks/useNow";
import type { ReflogEntryDto } from "@/shared/ipc/bindings";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";

import { useReflog } from "../api/reflog";
import { describe, entryName, isDeletion, selectCommit } from "../lib/reflog";
import { showReference, useShownReference } from "../store/reflog";
import { ReflogMenu } from "./ReflogMenu";

const ROW_HEIGHT_PX = 26;
/** Relative times ("5 minutes ago") are brought up to date this often. */
const RELATIVE_DATE_REFRESH_MS = 60_000;
const MS_PER_SECOND = 1000;

interface ReflogProps {
  repoId: number;
  repoPath: string;
}

/**
 * The reflog of HEAD (or a local branch), newest first: every commit, checkout, reset, merge
 * and rebase step. Choosing an entry selects its commit in the graph; its menu restores that
 * state or creates a branch there.
 */
export function Reflog({ repoId, repoPath }: ReflogProps) {
  const reference = useShownReference(repoPath);
  const log = useReflog(repoId, reference);
  const head = useActiveRepository().summary?.head;
  const currentBranch = head?.kind === "branch" ? `refs/heads/${head.name}` : null;
  // Counted from the oldest entry, so the same entry stays active when new ones arrive on top.
  const [activeFromOldest, setActiveFromOldest] = useState<number | undefined>(undefined);
  const entries = log.data?.entries ?? [];
  const active =
    activeFromOldest === undefined || activeFromOldest >= entries.length
      ? undefined
      : entries.length - 1 - activeFromOldest;
  const setActive = (index: number | undefined) => {
    setActiveFromOldest(index === undefined ? undefined : entries.length - 1 - index);
  };
  const references = log.data?.references ?? ["HEAD", reference];
  const now = useNow(RELATIVE_DATE_REFRESH_MS);

  const activate = (index: number) => {
    setActive(index);
    const entry = entries[index];
    if (entry && !isDeletion(entry)) void selectCommit(repoId, repoPath, entry.newId);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-1 border-b border-border px-2 py-1">
        <select
          aria-label="Whose reflog"
          value={reference}
          onChange={(event) => {
            setActive(undefined);
            showReference(repoPath, event.target.value);
          }}
          className="border-input h-7 min-w-0 rounded-md border bg-background px-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {[...new Set(references)].map((name) => (
            <option key={name} value={name}>
              {name === "HEAD" ? "HEAD (everything you did)" : name.replace(/^refs\/heads\//, "")}
            </option>
          ))}
        </select>
        <span className="flex-1" />
        <Button
          variant="ghost"
          size="icon"
          className="size-6"
          aria-label="Refresh the reflog"
          disabled={log.isFetching}
          onClick={() => void log.refetch()}
        >
          <RefreshCwIcon aria-hidden />
        </Button>
      </div>
      {log.error ? (
        <ErrorState
          error={log.error}
          title="Could not read the reflog"
          onRetry={() => void log.refetch()}
          className="flex-1 justify-center"
        />
      ) : !log.data ? (
        <LoadingState label="Reading the reflog…" className="flex-1" />
      ) : entries.length === 0 ? (
        <EmptyState
          icon={HistoryIcon}
          title="No reflog"
          description="Git keeps no reflog for this (core.logAllRefUpdates is off, or it was just created)."
          className="flex-1"
        />
      ) : (
        <ReflogMenu
          repoId={repoId}
          reference={reference}
          current={reference === "HEAD" || reference === currentBranch}
          entry={active === undefined ? undefined : entries[active]}
        >
          {/* The menu's trigger needs an element that takes its props; the list does not. */}
          <div className="flex min-h-0 flex-1 flex-col">
            <VirtualList
              className="flex-1"
              label={`Reflog of ${reference}`}
              count={entries.length}
              rowHeight={ROW_HEIGHT_PX}
              activeIndex={active}
              onActiveChange={setActive}
              onActivate={activate}
              rowLabel={(index) => {
                const entry = entries[index];
                if (!entry) return "";
                return `${entryName(reference, entry)}, ${entry.message}, ${relativeTime(entry, now)}`;
              }}
              renderRow={(index, isActive) => {
                const entry = entries[index];
                return entry ? (
                  <ReflogRow reference={reference} entry={entry} active={isActive} now={now} />
                ) : null;
              }}
            />
            {log.data.truncated ? (
              <p className="shrink-0 border-t border-border px-2 py-1 text-xs text-muted-foreground">
                Only the newest {entries.length.toLocaleString("en-US")} entries are shown.
              </p>
            ) : null}
          </div>
        </ReflogMenu>
      )}
    </div>
  );
}

/** "2 min ago"; an entry newer than the clock's last tick is "just now", not a date. */
function relativeTime(entry: ReflogEntryDto, nowMs: number): string {
  return formatRelativeDate(entry.time, Math.max(nowMs, (entry.time ?? 0) * MS_PER_SECOND));
}

interface ReflogRowProps {
  reference: string;
  entry: ReflogEntryDto;
  active: boolean;
  now: number;
}

function ReflogRow({ reference, entry, active, now }: ReflogRowProps) {
  const { action, detail } = describe(entry.message);
  return (
    <div
      className={cn(
        "flex h-full items-center gap-2 px-2 text-sm",
        active && "bg-accent text-accent-foreground",
      )}
      title={`${entryName(reference, entry)} ${entry.newId}\n${entry.message}\n${entry.committer}, ${formatCommitDate(entry.time)}`}
    >
      <span className="shrink-0 font-mono text-xs text-muted-foreground">
        {isDeletion(entry) ? "deleted" : shortId(entry.newId)}
      </span>
      <span className="shrink-0 font-medium">{action}</span>
      <span className="min-w-0 flex-1 truncate text-muted-foreground">{detail}</span>
      <span className="shrink-0 text-xs text-muted-foreground">{relativeTime(entry, now)}</span>
    </div>
  );
}

/** Reflog module: where HEAD (or a branch) pointed before each change, to get lost work back. */
export function ReflogModule() {
  return (
    <WithActiveRepository>
      {(summary, tab) => <Reflog repoId={summary.id} repoPath={tab.path} />}
    </WithActiveRepository>
  );
}
