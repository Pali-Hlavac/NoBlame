/** Helpers for submodule trees in the Repositories module. */
import { shortId } from "@/features/graph";
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

/** It is checked out at another commit than the one its parent records ("new commits"). */
export function hasNewCommits(submodule: SubmoduleDto): boolean {
  return (
    submodule.initialized &&
    submodule.recorded !== null &&
    submodule.checkedOut !== null &&
    submodule.recorded !== submodule.checkedOut
  );
}

/** The submodules in `submodules` and below them that have new commits, in tree order. */
export function withNewCommits(submodules: readonly SubmoduleDto[]): SubmoduleDto[] {
  return submodules.flatMap((submodule) => [
    ...(hasNewCommits(submodule) ? [submodule] : []),
    ...withNewCommits(submodule.children),
  ]);
}

/** The row's tooltip: where it is, or why it cannot be opened, and whether it moved. */
export function submoduleTitle(submodule: SubmoduleDto): string {
  if (!submodule.initialized) {
    return `${submodule.path} is not initialized. Right-click it to initialize it.`;
  }
  const lines = [submodule.workDir];
  if (submodule.url) lines.push(submodule.url);
  if (hasNewCommits(submodule)) {
    lines.push(
      `New commits: checked out at ${shortId(submodule.checkedOut ?? "")}, the repository records ${shortId(submodule.recorded ?? "")}.`,
    );
  }
  return lines.join("\n");
}
