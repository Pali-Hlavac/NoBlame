import { shortId } from "@/features/graph";
import type { UniqueCommitsDto } from "@/shared/ipc/bindings";

/** The newest few of some commits, by id and subject, and how many older ones there are. */
export function CommitList({ commits }: { commits: UniqueCommitsDto }) {
  const more = commits.count - commits.newest.length;
  return (
    <span className="mt-2 block rounded-md border border-border p-2 font-mono text-xs text-foreground">
      {commits.newest.map((commit) => (
        <span key={commit.id} className="block truncate">
          {shortId(commit.id)} {commit.summary}
        </span>
      ))}
      {more > 0 && (
        <span className="block text-muted-foreground">
          and {more.toLocaleString()} older {more === 1 ? "commit" : "commits"}
        </span>
      )}
    </span>
  );
}
