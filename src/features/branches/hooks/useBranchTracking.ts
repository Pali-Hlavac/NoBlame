import { useCallback, useMemo, useState } from "react";

import { useSettledValue } from "@/shared/hooks/useSettledValue";

import { useAheadBehind, useUpstreams } from "../api/upstreams";
import type { BranchRow } from "../lib/rows";
import type { BranchTracking } from "../lib/tracking";

/** Wait this long after scrolling stops before counting the rows now shown. */
const COUNT_SETTLE_MS = 150;

/**
 * The upstream of each local branch in the Branches list, with ahead/behind counted for the
 * rows on screen only. Pass `onRangeChange` to the list.
 */
export function useBranchTracking(repoId: number, rows: readonly BranchRow[]) {
  const upstreams = useUpstreams(repoId).data;
  const byBranch = useMemo(
    () => new Map((upstreams ?? []).map((upstream) => [upstream.branch, upstream])),
    [upstreams],
  );
  const [range, setRange] = useState<readonly [number, number]>([0, 0]);
  const [first, last] = useSettledValue(range, COUNT_SETTLE_MS);
  const shown = useMemo(() => {
    const names: string[] = [];
    for (const row of rows.slice(first, last + 1)) {
      if (row.type !== "ref" || row.entry.label.kind !== "branch") continue;
      const upstream = byBranch.get(row.entry.label.name);
      if (upstream && !upstream.gone) names.push(upstream.branch);
    }
    return names;
  }, [rows, first, last, byBranch]);
  const counted = useAheadBehind(repoId, shown).data;
  const counts = useMemo(
    () => new Map((counted ?? []).map((entry) => [entry.branch, entry])),
    [counted],
  );

  const onRangeChange = useCallback((from: number, to: number) => {
    setRange((current) => (current[0] === from && current[1] === to ? current : [from, to]));
  }, []);

  const trackingOf = useCallback(
    (branch: string): BranchTracking | undefined => {
      const upstream = byBranch.get(branch);
      if (!upstream) return undefined;
      const count = counts.get(branch);
      return {
        upstream: upstream.upstream,
        gone: upstream.gone || (count?.gone ?? false),
        counts: count && !count.gone ? { ahead: count.ahead, behind: count.behind } : undefined,
      };
    },
    [byBranch, counts],
  );

  return { onRangeChange, trackingOf };
}
