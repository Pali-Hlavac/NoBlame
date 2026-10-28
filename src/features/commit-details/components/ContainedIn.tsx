import { useId } from "react";

import { RefBadge } from "@/features/graph";
import type { RefLabel } from "@/shared/ipc/bindings";

/** Sections in display order. A detached HEAD is not a place a commit is "contained in". */
const SECTIONS: readonly { kind: RefLabel["kind"]; title: string }[] = [
  { kind: "branch", title: "Branches" },
  { kind: "remote", title: "Remote branches" },
  { kind: "tag", title: "Tags" },
];

interface ContainedInProps {
  refs: readonly RefLabel[];
  /** All containing refs; `refs` may be a prefix of them. */
  total: number;
}

/** Branches, remote branches and tags whose history includes the commit. */
export function ContainedIn({ refs, total }: ContainedInProps) {
  const hidden = total - refs.length;
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="space-y-2">
      <h4 id={headingId} className="text-xs font-semibold text-muted-foreground uppercase">
        Contained in
      </h4>
      {total === 0 && (
        <p className="text-muted-foreground">No branch or tag contains this commit.</p>
      )}
      {SECTIONS.map(({ kind, title }) => {
        const labels = refs.filter((label) => label.kind === kind);
        if (labels.length === 0) return null;
        return (
          <div key={kind} className="space-y-1">
            <p className="text-xs text-muted-foreground">
              {title} ({labels.length})
            </p>
            <div className="flex flex-wrap gap-1">
              {labels.map((label) => (
                <RefBadge key={label.name} label={label} />
              ))}
            </div>
          </div>
        );
      })}
      {hidden > 0 && <p className="text-xs text-muted-foreground">and {hidden} more</p>}
    </section>
  );
}
