import {
  ArchiveRestoreIcon,
  EllipsisIcon,
  EyeIcon,
  PackageOpenIcon,
  Trash2Icon,
} from "lucide-react";

import { formatCommitDate } from "@/features/graph";
import type { StashDto } from "@/shared/ipc/bindings";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";

import { stashDescription, stashName } from "../lib/files";

interface StashItemProps {
  stash: StashDto;
  /** It is the stash the Stash tab shows. */
  shown: boolean;
  busy: boolean;
  onShow: (stash: StashDto) => void;
  onApply: (stash: StashDto) => void;
  onPop: (stash: StashDto) => void;
  onDrop: (stash: StashDto) => void;
}

/** One stash: a click shows it in the Stash tab; its menu applies, pops or drops it. */
export function StashItem({ stash, shown, busy, ...on }: StashItemProps) {
  return (
    <li
      className={cn(
        "group/item flex items-center gap-1 rounded-md pr-1",
        shown ? "bg-accent text-accent-foreground" : "hover:bg-muted/60",
      )}
    >
      <button
        type="button"
        className="min-w-0 flex-1 space-y-0.5 rounded-md px-2 py-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
        title={`${stash.message}\n${stash.id}`}
        aria-current={shown || undefined}
        onClick={() => {
          on.onShow(stash);
        }}
      >
        <span className="flex items-baseline gap-2">
          <code className="shrink-0 font-mono text-xs text-muted-foreground">
            {stashName(stash)}
          </code>
          <span className="truncate text-sm">{stashDescription(stash)}</span>
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {stash.branch ? `on ${stash.branch} · ` : ""}
          {formatCommitDate(stash.time)}
        </span>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 shrink-0 opacity-0 group-hover/item:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
            aria-label={`Actions for ${stashName(stash)}`}
          >
            <EllipsisIcon aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() => {
              on.onShow(stash);
            }}
          >
            <EyeIcon aria-hidden />
            Show files
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={busy}
            onSelect={() => {
              on.onApply(stash);
            }}
          >
            <ArchiveRestoreIcon aria-hidden />
            Apply
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={busy}
            onSelect={() => {
              on.onPop(stash);
            }}
          >
            <PackageOpenIcon aria-hidden />
            Pop (apply and drop)
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={() => {
              on.onDrop(stash);
            }}
          >
            <Trash2Icon aria-hidden />
            Drop…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
