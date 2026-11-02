/** Opens the compare tab from the graph: a commit with HEAD, a reference, or two rows. */
import { toast } from "sonner";

import { compare, type Comparison } from "@/features/selection";
import { showCompareTab } from "@/features/workspace";
import { commands, toIpcError, unwrap } from "@/shared/ipc/client";

/** Compares two revisions in the compare tab and shows it. */
export function openComparison(repoPath: string, comparison: Comparison): void {
  compare(repoPath, comparison);
  showCompareTab();
}

async function commitIdAt(repoId: number, row: number): Promise<string> {
  const [text] = await unwrap(commands.getCommitRows(repoId, row, 1));
  if (!text) throw new Error(`The graph has no row ${row}.`);
  return text.id;
}

/**
 * Compares the commits on two rows (Ctrl+click), the one further down the graph as the base: it
 * is usually the older one, so added lines are what came later.
 */
export async function compareRows(
  repoId: number,
  repoPath: string,
  one: number,
  two: number,
): Promise<void> {
  const [older, newer] = one > two ? [one, two] : [two, one];
  try {
    const [base, target] = await Promise.all([
      commitIdAt(repoId, older),
      commitIdAt(repoId, newer),
    ]);
    openComparison(repoPath, { base, target, sinceMergeBase: false });
  } catch (error) {
    toast.error("Could not compare the commits", { description: toIpcError(error).message });
  }
}
