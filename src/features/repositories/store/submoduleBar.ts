/** The submodule states whose bar the user dismissed, per repository path (this session only). */
import { create } from "zustand";

interface SubmoduleBarState {
  dismissed: Record<string, string | undefined>;
  dismiss: (path: string, key: string) => void;
}

export const useSubmoduleBarStore = create<SubmoduleBarState>()((set) => ({
  dismissed: {},
  dismiss: (path, key) => {
    set((state) => ({ dismissed: { ...state.dismissed, [path]: key } }));
  },
}));
