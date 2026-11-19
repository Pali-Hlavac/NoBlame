import { PlusIcon, RefreshCwIcon } from "lucide-react";

import type { RemoteDto } from "@/shared/ipc/bindings";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";

import { branchCount, namedList } from "../lib/remotes";

interface RemoteListProps {
  remotes: readonly RemoteDto[];
  /** The remote shown in the editor; null while adding one. */
  selected: string | null;
  onSelect: (name: string) => void;
  onAdd: () => void;
  /** Fetches a remote; undefined when the repository's folder is not known. */
  onFetch: ((name: string) => void) | undefined;
}

/** The remotes, one of them chosen for the editor, each with a fetch button. */
export function RemoteList({ remotes, selected, onSelect, onAdd, onFetch }: RemoteListProps) {
  return (
    <div className="flex min-h-0 flex-col gap-2">
      <ul aria-label="Remotes" className="flex min-h-0 flex-1 flex-col gap-1 overflow-auto">
        {remotes.map((remote) => {
          const facts = [
            branchCount(remote.branches),
            remote.trackedBy.length > 0 && `tracked by ${namedList(remote.trackedBy)}`,
          ].filter(Boolean);
          const current = remote.name === selected;
          return (
            <li key={remote.name} className="flex items-start gap-1">
              <button
                type="button"
                aria-current={current ? "true" : undefined}
                className={cn(
                  "min-w-0 flex-1 rounded-md px-2 py-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  current ? "bg-accent text-accent-foreground" : "hover:bg-muted",
                )}
                onClick={() => {
                  onSelect(remote.name);
                }}
              >
                <span className="block text-sm font-medium">{remote.name}</span>
                <span
                  className="block truncate font-mono text-xs"
                  title={remote.shownUrl ?? undefined}
                >
                  {remote.shownUrl ?? "(no URL)"}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {facts.join(" · ")}
                </span>
              </button>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
                aria-label={`Fetch ${remote.name}`}
                title={`Fetch ${remote.name}`}
                disabled={!onFetch}
                onClick={() => onFetch?.(remote.name)}
              >
                <RefreshCwIcon aria-hidden />
              </Button>
            </li>
          );
        })}
      </ul>
      <Button variant="outline" className="justify-start" onClick={onAdd}>
        <PlusIcon aria-hidden />
        Add remote…
      </Button>
    </div>
  );
}
