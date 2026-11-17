/** The update the last check found, and whether its dialog is open (UI state only). */
import { create } from "zustand";

import type { AvailableUpdate } from "@/shared/ipc/bindings";

interface UpdatesState {
  /** The newer release the feed offers; null when none was found (yet). */
  available: AvailableUpdate | null;
  dialogOpen: boolean;
}

export const useUpdatesStore = create<UpdatesState>()(() => ({
  available: null,
  dialogOpen: false,
}));

/** Shows the dialog for `update` (its notes, Install and restart). */
export function showUpdate(update: AvailableUpdate): void {
  useUpdatesStore.setState({ available: update, dialogOpen: true });
}

export function closeUpdateDialog(): void {
  useUpdatesStore.setState({ dialogOpen: false });
}
