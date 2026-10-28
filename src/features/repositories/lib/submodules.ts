/** Helpers for submodule trees in the Repositories module. */
import type { SubmoduleDto } from "@/shared/ipc/bindings";

import { repositoryTab } from "./path";

/** Tab ids of every submodule in `trees`, at any depth. */
export function submoduleTabIds(trees: readonly (readonly SubmoduleDto[])[]): Set<string> {
  const ids = new Set<string>();
  const visit = (submodules: readonly SubmoduleDto[]): void => {
    for (const submodule of submodules) {
      ids.add(repositoryTab(submodule.workDir).id);
      visit(submodule.children);
    }
  };
  trees.forEach(visit);
  return ids;
}
