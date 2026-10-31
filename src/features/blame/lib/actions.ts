/** What the blame tab does with a line's commit: select it, show its change. */
import { toast } from "sonner";

import { goToCommit } from "@/features/graph";
import { selectFile, selectRow } from "@/features/selection";
import { showDiffTab } from "@/features/workspace";

/** Why a commit cannot be selected in the graph. */
const NOT_SHOWN = {
  hiddenByFilter: "The graph's filter hides this commit. Clear the filter to select it.",
  notInGraph: "This commit is not on any branch or tag the graph shows.",
} as const;

/** Selects commit `id` in the graph; returns false (with a toast) when it is not shown. */
export async function selectCommit(repoId: number, repoPath: string, id: string) {
  try {
    const found = await goToCommit(repoId, id);
    if (found.status === "shown" && found.row !== null) {
      selectRow(repoPath, found.row);
      return true;
    }
    toast.info(NOT_SHOWN[found.status === "shown" ? "notInGraph" : found.status]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    toast.error("Could not find the commit", { description: message });
  }
  return false;
}

/** Selects commit `id` and shows its change to the file (`path` is its name there). */
export async function showChange(repoId: number, repoPath: string, id: string, path: string) {
  if (!(await selectCommit(repoId, repoPath, id))) return;
  selectFile(repoPath, path);
  showDiffTab();
}
