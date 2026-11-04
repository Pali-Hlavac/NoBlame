/** Public API of the working tree feature: the status and its files (staging is in `commit`). */
export {
  useDiscardFiles,
  useLineChange,
  type DiscardedFiles,
  type LineAction,
} from "./api/changes";
export { useIgnoreFiles, useIgnorePreview } from "./api/ignore";
export {
  statusKeys,
  useStatusSummary,
  useWorkingTreeStatus,
  useWorktreeFileId,
} from "./api/status";
export { WorkingTreeChip, WorkingTreeDetails } from "./components/WorkingTreeSummary";
export { filesOf, totalOf } from "./lib/files";
export { workingTreeRows, type WorkingTreeKind, type WorkingTreeRow } from "./lib/rows";
