/**
 * The file chosen in the compare tab of each repository. It stays when the revisions change, so
 * the same file is shown in the new comparison if it differs there too.
 */
import { create } from "zustand";

interface CompareState {
  files: Record<string, string | undefined>;
}

export const useCompareStore = create<CompareState>()(() => ({ files: {} }));

/** The path chosen in `repoPath`'s compare tab. */
export function useComparedFile(repoPath: string): string | undefined {
  return useCompareStore((state) => state.files[repoPath]);
}

/** Chooses the file whose diff the compare tab shows. */
export function chooseComparedFile(repoPath: string, path: string): void {
  useCompareStore.setState((state) => ({ files: { ...state.files, [repoPath]: path } }));
}
