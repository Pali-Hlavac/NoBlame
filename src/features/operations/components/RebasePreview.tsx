import { CommitList } from "@/features/graph";
import type { RebasePreviewDto } from "@/shared/ipc/bindings";
import { toIpcError } from "@/shared/ipc/client";

import { commits } from "../lib/history";

interface RebasePreviewProps {
  target: string;
  onto: string;
  preview: { isPending: boolean; error: unknown; data: RebasePreviewDto | undefined };
}

/**
 * What a rebase does, named before it runs: the commits replayed (they get new ids), and a
 * warning when some were pushed already.
 */
export function RebasePreview({ target, onto, preview }: RebasePreviewProps) {
  if (preview.isPending) {
    return (
      <p className="text-sm text-muted-foreground">Counting the commits of {target} to replay…</p>
    );
  }
  if (!preview.data) {
    return (
      <p className="text-sm text-muted-foreground">
        Could not count the commits to replay: {toIpcError(preview.error).message}
      </p>
    );
  }
  const { replayed, published } = preview.data;
  if (replayed.count === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {target} has no commits of its own since {onto}: it simply moves to {onto} (or already
        contains it).
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2 text-sm">
      <div>
        <p>
          {commits(replayed.count)} of {target} {replayed.count === 1 ? "is" : "are"} replayed on{" "}
          {onto} and get new ids:
        </p>
        <CommitList commits={replayed} />
      </div>
      {published > 0 ? (
        <p className="font-medium text-destructive">
          {published === replayed.count
            ? `${replayed.count === 1 ? "It was" : "All of them were"} pushed already.`
            : `${String(published)} of them ${published === 1 ? "was" : "were"} pushed already.`}{" "}
          After the rebase, {target} must be pushed with force, and anyone who built on them has to
          rebase too.
        </p>
      ) : null}
    </div>
  );
}
