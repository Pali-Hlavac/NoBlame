/** Whether the commit dialog is open (it commits in the active repository). */
import { create } from "zustand";

interface CommitDialogState {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export const useCommitDialogStore = create<CommitDialogState>()((set) => ({
  open: false,
  setOpen: (open) => {
    set({ open });
  },
}));

/** Opens the commit dialog for the active repository. */
export function openCommitDialog(): void {
  useCommitDialogStore.getState().setOpen(true);
}
