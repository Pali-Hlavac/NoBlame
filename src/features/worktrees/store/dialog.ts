/** Which worktree dialog is open. */
import { create } from "zustand";

import type { WorktreeDto } from "@/shared/ipc/bindings";

export type WorktreeDialog =
  | { kind: "add" }
  | { kind: "remove"; worktree: WorktreeDto }
  | { kind: "lock"; worktree: WorktreeDto }
  | { kind: "prune"; prunable: readonly WorktreeDto[] };

interface WorktreeDialogState {
  dialog: WorktreeDialog | null;
  open: (dialog: WorktreeDialog) => void;
  close: () => void;
}

export const useWorktreeDialog = create<WorktreeDialogState>()((set) => ({
  dialog: null,
  open: (dialog) => {
    set({ dialog });
  },
  close: () => {
    set({ dialog: null });
  },
}));
