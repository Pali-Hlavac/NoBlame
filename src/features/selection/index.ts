/** Public API of the shared selection (selected commit or working tree row per repository). */
export {
  select,
  selectFile,
  selectRow,
  useSelectedFile,
  useSelectedRow,
  useSelection,
  useSelectionStore,
  type SelectedFile,
  type Selection,
} from "./store/selection";
