/** Public API of the shared selection (selected commit or working tree row per repository). */
export {
  compare,
  compareWithParent,
  select,
  selectFile,
  selectRow,
  useComparedParent,
  useComparison,
  useSelectedFile,
  useSelectedRow,
  useSelection,
  useSelectionStore,
  WORKING_TREE,
  type Comparison,
  type Selection,
} from "./store/selection";
