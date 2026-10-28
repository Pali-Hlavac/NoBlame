/** Public API of the shared selection (selected commit or working tree row per repository). */
export {
  compareWithParent,
  select,
  selectFile,
  selectRow,
  useComparedParent,
  useSelectedFile,
  useSelectedRow,
  useSelection,
  useSelectionStore,
  type Selection,
} from "./store/selection";
