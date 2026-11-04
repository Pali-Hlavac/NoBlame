import { toast } from "sonner";

import type { ApplyOutcomeDto, StashDto } from "@/shared/ipc/bindings";

import { useApplyStash } from "../api/stashes";
import { stashName } from "../lib/files";
import { forgetStash, useShownStashStore } from "../store/shown";

/** Tells how applying went; conflicts are a warning, not an error. */
export function reportApplied(what: string, outcome: ApplyOutcomeDto, kept: boolean): void {
  if (outcome.conflicts) {
    toast.warning(`${what}: conflicts`, {
      description: `Resolve them, then stage the files in the Commit module.${kept ? " The stash was kept." : ""}`,
    });
  } else {
    toast.success(what);
  }
}

/** Apply and Pop for a whole stash, with the "restore staged changes" choice. */
export function useStashActions(repoId: number, repoPath: string) {
  const mutation = useApplyStash(repoId);
  const restoreIndex = useShownStashStore((state) => state.restoreIndex);

  const run = (stash: StashDto, pop: boolean): void => {
    mutation.mutate(
      { stash: { index: stash.index, id: stash.id }, pop, restoreIndex },
      {
        onSuccess: (outcome) => {
          const verb = pop ? "Popped" : "Applied";
          reportApplied(`${verb} ${stashName(stash)}`, outcome, pop);
          if (pop && !outcome.conflicts) forgetStash(repoPath, stash.id);
        },
      },
    );
  };

  return {
    busy: mutation.isPending,
    apply: (stash: StashDto) => {
      run(stash, false);
    },
    pop: (stash: StashDto) => {
      run(stash, true);
    },
  };
}
