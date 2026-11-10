/** Reflog entries as the Reflog module shows them, and selecting their commits in the graph. */
import { toast } from "sonner";

import { type StartPoint, goToCommit, shortId } from "@/features/graph";
import { selectRow } from "@/features/selection";
import type { ReflogEntryDto } from "@/shared/ipc/bindings";

/** What git did (`commit`, `checkout`, `reset`, `rebase (finish)`) and the rest of its words. */
export function describe(message: string): { action: string; detail: string } {
  const colon = message.indexOf(": ");
  if (colon < 0) return { action: message, detail: "" };
  return { action: message.slice(0, colon), detail: message.slice(colon + 2) };
}

/** Whether the entry deleted the reference (its new id is all zeros): no commit to act on. */
export function isDeletion(entry: ReflogEntryDto): boolean {
  return /^0+$/.test(entry.newId);
}

/** `HEAD@{2}`, `main@{0}`: how git names the entry. */
export function entryName(reference: string, entry: ReflogEntryDto): string {
  return `${reference.replace(/^refs\/heads\//, "")}@{${String(entry.index)}}`;
}

/** The entry's commit, for the branch actions: "a1b2c3d4 (HEAD@{2})". */
export function startPoint(reference: string, entry: ReflogEntryDto): StartPoint {
  return {
    revision: entry.newId,
    label: `${shortId(entry.newId)} (${entryName(reference, entry)})`,
  };
}

/** Why a commit cannot be selected in the graph. */
const NOT_SHOWN = {
  hiddenByFilter: "The graph's filter hides this commit. Clear the filter to select it.",
  notInGraph:
    "This commit is on no branch or tag: only the reflog still has it. Right-click it to create a branch there, or to restore this state.",
} as const;

/** Selects commit `id` in the graph; says why when it is not shown. */
export async function selectCommit(repoId: number, repoPath: string, id: string): Promise<void> {
  try {
    const found = await goToCommit(repoId, id);
    if (found.status === "shown" && found.row !== null) {
      selectRow(repoPath, found.row);
      return;
    }
    toast.info(NOT_SHOWN[found.status === "shown" ? "notInGraph" : found.status]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    toast.error("Could not find the commit", { description: message });
  }
}
