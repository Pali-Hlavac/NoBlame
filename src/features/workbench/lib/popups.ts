/**
 * Popping modules out of the dock and back. A popped-out module opens in a popup over the
 * window (modal, inside the app) wherever it would have opened in the dock; the choice is saved
 * with the layout.
 */
import { useWorkbenchStore } from "../store/workbench";
import { docks, openModuleById, scheduleLayoutSave } from "./docks";

/** Takes the module out of the dock and shows it in its popup, now and from then on. */
export function popOutModule(id: string): void {
  useWorkbenchStore.getState().popOut(id);
  docks.modules?.getPanel(id)?.api.close();
  scheduleLayoutSave();
}

/** Puts a popped-out module back into the dock (into the focused group) and shows it there. */
export function dockModule(id: string): void {
  useWorkbenchStore.getState().dock(id);
  openModuleById(id);
  scheduleLayoutSave();
}

/** Hides the popup; its module keeps its state for the next time it opens. */
export function closeModulePopup(): void {
  useWorkbenchStore.getState().closePopup();
}
