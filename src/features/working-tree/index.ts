/** Public API of the working tree feature: status summary now, staging and committing in M4. */
export { statusKeys, useStatusSummary } from "./api/status";
export { WorkingTreeChip, WorkingTreeDetails } from "./components/WorkingTreeSummary";
export {
  WORKING_TREE_MILESTONE,
  workingTreeRows,
  type WorkingTreeKind,
  type WorkingTreeRow,
} from "./lib/rows";
