/** What the unified and side-by-side views share. */
import type { FileDiffDto } from "@/shared/ipc/bindings";

import type { DiffRequest } from "../api/diff";

/** Classes of a scrolling diff region (rows are monospace, 20 px high, tabs 4 wide). */
export const REGION_CLASSES =
  "relative min-h-0 flex-1 font-mono text-xs leading-5 [tab-size:4] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset";

export interface LinesProps {
  request: DiffRequest;
  diff: FileDiffDto;
  /** Rows to show (at most `MAX_SHOWN_ROWS`). */
  count: number;
  /** Accessible name of the scrolling region, e.g. "Diff of src/main.rs". */
  label: string;
}
