import { LockIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { InlineError } from "@/shared/components/InlineError";
import type { LfsLockDto } from "@/shared/ipc/bindings";
import { Button } from "@/shared/ui/button";

import { useLfsLocks, useUnlockLfsFile } from "../api/lfs";

/** "Ada, 11 Nov 2026" from a lock. */
function heldBy(lock: LfsLockDto): string {
  const when = Date.parse(lock.lockedAt);
  const date = Number.isNaN(when) ? "" : new Date(when).toLocaleDateString();
  return [lock.owner ?? "someone", date].filter(Boolean).join(", ");
}

/**
 * The locks on the LFS server, read when asked (it is a network call): who holds which file,
 * and Unlock. A lock git-lfs will not release (someone else's) asks before forcing it.
 */
export function LfsLocks({ repoId }: { repoId: number }) {
  const [shown, setShown] = useState(false);
  const locks = useLfsLocks(repoId, shown);
  const list = locks.data?.locks;
  const unlock = useUnlockLfsFile(repoId);
  const [forcing, setForcing] = useState<LfsLockDto | null>(null);

  const release = (lock: LfsLockDto, force: boolean) => {
    unlock.mutate(
      { id: lock.id, force },
      {
        onSuccess: () => {
          setForcing(null);
          toast.success(`Unlocked ${lock.path}`);
        },
        onError: () => {
          // git-lfs refuses someone else's lock without --force: ask first.
          if (!force) setForcing(lock);
        },
      },
    );
  };

  return (
    <section aria-label="Locks" className="shrink-0 border-t border-border p-2 text-sm">
      <div className="flex items-center gap-2">
        <LockIcon className="size-4 text-muted-foreground" aria-hidden />
        <span className="flex-1 font-medium">Locks</span>
        <Button
          size="sm"
          variant="outline"
          className="h-7"
          disabled={locks.isFetching}
          onClick={() => {
            if (shown) void locks.refetch();
            else setShown(true);
          }}
        >
          {locks.isFetching ? "Asking the server…" : shown ? "Refresh" : "Show locks"}
        </Button>
      </div>
      {locks.error ? <InlineError error={locks.error} className="mt-2" /> : null}
      {list?.length === 0 && !locks.data?.warning ? (
        <p className="mt-2 text-xs text-muted-foreground">Nobody holds a lock.</p>
      ) : null}
      {list?.length === 0 && locks.data?.warning ? (
        <div className="mt-2 text-xs" role="status">
          <p className="text-warning">{locks.data.hint ?? "Git LFS could not list the locks:"}</p>
          <pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap text-muted-foreground">
            {locks.data.warning}
          </pre>
        </div>
      ) : null}
      {list && list.length > 0 ? (
        <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">
          {list.map((lock) => (
            <li key={lock.id} className="flex items-center gap-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate" title={lock.path}>
                  {lock.path}
                </span>
                <span className="block truncate text-xs text-muted-foreground">{heldBy(lock)}</span>
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="h-7"
                disabled={unlock.isPending}
                onClick={() => {
                  release(lock, false);
                }}
              >
                Unlock
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      <ConfirmDialog
        open={forcing !== null}
        onOpenChange={(open) => {
          if (!open) setForcing(null);
        }}
        title="Force the unlock?"
        description={`The server refused to unlock ${forcing?.path ?? ""}: it is ${forcing?.owner ?? "someone else"}'s lock. Forcing it lets anyone change the file again; they may lose work if they are still editing it.`}
        confirmLabel="Force the unlock"
        destructive
        pending={unlock.isPending}
        error={unlock.error}
        onConfirm={() => {
          if (forcing) release(forcing, true);
        }}
      />
    </section>
  );
}
