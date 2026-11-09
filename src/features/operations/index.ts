/**
 * Public API of the operations feature: merging into the current branch, and the bar showing
 * the operation in progress (merge, cherry-pick, revert, rebase) with Continue, Skip and Abort.
 */
export { OperationBanner } from "./components/OperationBanner";
export { OperationDialogs } from "./components/OperationDialogs";
export { openMerge } from "./store/dialog";
