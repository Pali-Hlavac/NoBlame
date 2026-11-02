/** Public API of the working tree feature: the status and its files; staging and committing in M4. */
export {
  statusKeys,
  useStatusSummary,
  useWorkingTreeStatus,
  useWorktreeFileId,
} from "./api/status";
export { WorkingTreeChip, WorkingTreeDetails } from "./components/WorkingTreeSummary";
export { filesOf, totalOf } from "./lib/files";
export {
  WORKING_TREE_MILESTONE,
  workingTreeRows,
  type WorkingTreeKind,
  type WorkingTreeRow,
} from "./lib/rows";
