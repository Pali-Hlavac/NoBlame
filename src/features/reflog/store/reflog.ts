/** Whose reflog the Reflog module shows in each repository (UI state, keyed by its path). */
import { create } from "zustand";

interface ReflogState {
  references: Record<string, string | undefined>;
}

export const useReflogStore = create<ReflogState>()(() => ({ references: {} }));

/** The reference shown for `repoPath`: `HEAD` until another is chosen. */
export function useShownReference(repoPath: string): string {
  return useReflogStore((state) => state.references[repoPath] ?? "HEAD");
}

/** Shows the reflog of `reference` for `repoPath`. */
export function showReference(repoPath: string, reference: string): void {
  useReflogStore.setState((state) => ({
    references: { ...state.references, [repoPath]: reference },
  }));
}
