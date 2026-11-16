import { useQueryClient } from "@tanstack/react-query";
import { PackageIcon, XIcon } from "lucide-react";
import { useEffect } from "react";

import { useWorkingTreeStatus } from "@/features/working-tree";
import { Button } from "@/shared/ui/button";

import { submoduleKeys, useSubmodules } from "../api/submodules";
import { useCheckOutRecorded } from "../hooks/useSubmoduleUpdate";
import { driftKey, driftSubject, driftedPaths } from "../lib/drift";
import { useSubmoduleBarStore } from "../store/submoduleBar";

interface SubmoduleBarProps {
  repoId: number;
  /** The repository's work tree (where the update runs). */
  path: string;
}

/**
 * The bar above the commits when submodules are not on the commits the repository records
 * (after a pull or checkout that did not update them): **Update** moves them there (a job),
 * × hides the bar until the recorded or checked-out commits change.
 */
export function SubmoduleBar({ repoId, path }: SubmoduleBarProps) {
  const queryClient = useQueryClient();
  const status = useWorkingTreeStatus(repoId);
  const paths = driftedPaths(status.data);
  const submodules = useSubmodules(path, paths.length > 0);
  const dismissed = useSubmoduleBarStore((state) => state.dismissed[path]);
  const checkOutRecorded = useCheckOutRecorded(path);

  // The status follows the watcher; the submodule list (their commits) is read again with it.
  const statusAt = status.dataUpdatedAt;
  useEffect(() => {
    void queryClient.invalidateQueries({ queryKey: submoduleKeys.byPath(path) });
  }, [queryClient, path, statusAt]);

  if (paths.length === 0) return null;
  const key = driftKey(paths, submodules.data ?? []);
  if (dismissed === key) return null;
  return (
    <section
      aria-label="Submodules not on the recorded commits"
      className="flex shrink-0 items-center gap-2 border-b border-border bg-kind-submodules/10 px-3 py-1.5 text-sm"
    >
      <PackageIcon className="size-4 shrink-0 text-kind-submodules" aria-hidden />
      <span className="min-w-0 flex-1 truncate" title={paths.join("\n")}>
        {driftSubject(paths)} not on the {paths.length === 1 ? "commit" : "commits"} this repository
        records.
      </span>
      <Button
        size="sm"
        variant="outline"
        className="h-7"
        onClick={() => {
          checkOutRecorded(paths);
        }}
      >
        Update {paths.length === 1 ? "it" : "them"}
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="size-7"
        aria-label="Hide until the submodules change"
        title="Keep them where they are"
        onClick={() => {
          useSubmoduleBarStore.getState().dismiss(path, key);
        }}
      >
        <XIcon />
      </Button>
    </section>
  );
}
