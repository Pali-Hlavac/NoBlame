import { useWorkbenchStore } from "../store/workbench";

/** True while a module's popup is open: the rest of the window must be inert meanwhile. */
export function useModulePopupOpen(): boolean {
  return useWorkbenchStore((state) => state.popup !== null);
}
