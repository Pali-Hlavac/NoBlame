import { GitBranchIcon, GlobeIcon, SearchCheckIcon, TagIcon } from "lucide-react";

import type { RefLabel } from "@/shared/ipc/bindings";
import { cn } from "@/shared/lib/cn";

const KIND_STYLES: Record<RefLabel["kind"], string> = {
  branch: "bg-ref-branch text-ref-branch-foreground",
  remote: "bg-ref-remote text-ref-remote-foreground",
  tag: "bg-ref-tag text-ref-tag-foreground",
  head: "bg-ref-head text-foreground",
  bisect: "bg-muted text-muted-foreground",
};

/** A bisect's marks: bad in red, good in green, skipped in grey. */
const BISECT_STYLES: Readonly<Record<string, string>> = {
  bad: "bg-destructive/20 text-destructive",
  good: "bg-success/20 text-success",
};

const KIND_ICONS = {
  branch: GitBranchIcon,
  remote: GlobeIcon,
  tag: TagIcon,
  head: null,
  bisect: SearchCheckIcon,
} as const;

const KIND_NAMES: Record<RefLabel["kind"], string> = {
  branch: "branch",
  remote: "remote branch",
  tag: "tag",
  head: "detached HEAD",
  bisect: "bisect mark",
};

/** A reference label in front of a commit message. The current branch is outlined. */
export function RefBadge({ label }: { label: RefLabel }) {
  const Icon = KIND_ICONS[label.kind];
  return (
    <span
      title={`${KIND_NAMES[label.kind]}${label.isHead ? " (HEAD)" : ""}: ${label.name}`}
      className={cn(
        "inline-flex max-w-48 shrink-0 items-center gap-1 rounded px-1.5 text-xs leading-5",
        (label.kind === "bisect" ? BISECT_STYLES[label.name] : undefined) ??
          KIND_STYLES[label.kind],
        label.isHead && "font-semibold ring-2 ring-ref-head ring-inset",
      )}
    >
      {Icon && <Icon className="size-3 shrink-0" aria-hidden />}
      <span className="truncate">{label.name}</span>
    </span>
  );
}
