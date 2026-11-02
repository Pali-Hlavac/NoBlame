import { shortId } from "@/features/graph";
import { selectRow } from "@/features/selection";
import type { CommitLinkDto } from "@/shared/ipc/bindings";

interface CommitLinksProps {
  links: readonly CommitLinkDto[];
  /** "parent" or "child", for the buttons' titles. */
  relation: string;
  repoPath: string;
}

/** Short ids of parents or children; each selects its row, unless the filter hides it. */
export function CommitLinks({ links, relation, repoPath }: CommitLinksProps) {
  return links.map(({ id, row }) =>
    row === null ? (
      <span
        key={id}
        className="font-mono text-xs text-muted-foreground"
        title={`${id} (hidden by the filter)`}
      >
        {shortId(id)}
      </span>
    ) : (
      <button
        key={id}
        className="rounded font-mono text-xs text-primary underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        title={`Select ${relation} ${id}`}
        onClick={() => {
          selectRow(repoPath, row);
        }}
      >
        {shortId(id)}
      </button>
    ),
  );
}
