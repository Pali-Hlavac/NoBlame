import { useMemo } from "react";

import { useAppSettings } from "@/features/settings";
import { useStatusSummary, workingTreeRows, type WorkingTreeRow } from "@/features/working-tree";

/** The working tree rows to show above the commits, unless Settings put them elsewhere. */
export function useWorkingTreeRows(repoId: number): readonly WorkingTreeRow[] {
  const shown = useAppSettings().graph.workingTree === "rows";
  const status = useStatusSummary(repoId, shown);
  return useMemo(() => (shown ? workingTreeRows(status.data) : []), [shown, status.data]);
}
