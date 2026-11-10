/**
 * Public API of the operations feature: merging into the current branch, cherry-picking,
 * reverting, resetting and rebasing, and the bar showing the operation in progress (merge, cherry-pick,
 * revert, rebase) with Continue, Skip and Abort; resolving conflicts, and the Merge tab (the
 * built-in three-way merge view), and bisecting (marks from the graph, the bisect bar).
 */
export { MergeView } from "./components/MergeView";
export { OperationBanner } from "./components/OperationBanner";
export { OperationDialogs } from "./components/OperationDialogs";
export { useOpenMergeTool } from "./api/conflicts";
export { useBisectActions } from "./hooks/useBisectActions";
export {
  openConflicts,
  openInteractive,
  openMerge,
  openPick,
  openRebase,
  openReset,
} from "./store/dialog";
export { showMergeView } from "./store/mergeView";
