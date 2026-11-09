import { CommitList } from "@/features/graph";
import { useWorkingTreeStatus } from "@/features/working-tree";
import type { ResetModeDto } from "@/shared/ipc/bindings";
import { toIpcError } from "@/shared/ipc/client";

import { useCommitsLeaving } from "../api/history";
import { commits, files } from "../lib/history";

interface ResetEffectsProps {
  repoId: number;
  commit: string;
  target: string;
  mode: ResetModeDto;
}

/**
 * What a reset does, named before it runs: the commits that leave the branch (still in the
 * reflog), and for a hard reset the uncommitted changes that are lost for good.
 */
export function ResetEffects({ repoId, commit, target, mode }: ResetEffectsProps) {
  const leaving = useCommitsLeaving(repoId, commit);
  const status = useWorkingTreeStatus(repoId);
  const summary = status.data?.summary;
  // Untracked files count as new; a hard reset keeps them.
  const lost = summary
    ? summary.changes.added - summary.untracked + summary.changes.changed + summary.changes.deleted
    : 0;

  return (
    <div className="flex flex-col gap-2 text-sm">
      {leaving.isPending ? (
        <p className="text-muted-foreground">Counting the commits that leave {target}…</p>
      ) : leaving.isError ? (
        <p className="text-muted-foreground">
          Could not count the commits that leave {target}: {toIpcError(leaving.error).message}
        </p>
      ) : leaving.data.count === 0 ? (
        <p className="text-muted-foreground">No commits leave {target}.</p>
      ) : (
        <div>
          <p>
            {commits(leaving.data.count)} {leaving.data.count === 1 ? "leaves" : "leave"} {target}
            {mode === "soft" || mode === "mixed" ? ", their changes stay in your files" : ""}:
          </p>
          <CommitList commits={leaving.data} />
          <p className="mt-1 text-xs text-muted-foreground">
            Other branches holding them keep them; the reflog remembers them for a while.
          </p>
        </div>
      )}
      {mode === "hard" ? (
        lost > 0 ? (
          <p className="font-medium text-destructive">
            Uncommitted changes to {files(lost)} are lost for good.
          </p>
        ) : (
          <p className="text-muted-foreground">You have no uncommitted changes to lose.</p>
        )
      ) : null}
    </div>
  );
}
