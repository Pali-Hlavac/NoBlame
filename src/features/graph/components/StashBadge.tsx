import { ArchiveIcon } from "lucide-react";

import type { StashLabel } from "@/shared/ipc/bindings";

/** A stash made on this commit: `stash@{n}`, its message in the tooltip. */
export function StashBadge({ stash }: { stash: StashLabel }) {
  const name = `stash@{${stash.index}}`;
  return (
    <span
      title={`${name}: ${stash.message}\nStashed on this commit; see it in the Stashes module.`}
      className="inline-flex max-w-48 shrink-0 items-center gap-1 rounded bg-kind-stash/20 px-1.5 text-xs leading-5 text-foreground ring-1 ring-kind-stash ring-inset"
    >
      <ArchiveIcon className="size-3 shrink-0 text-kind-stash" aria-hidden />
      <span className="truncate">{name}</span>
    </span>
  );
}
