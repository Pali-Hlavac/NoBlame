/**
 * What the Files module shows in each repository: the open folders, the row with the cursor
 * and the file chosen for the file tab. All by path, so they carry over to the next commit
 * selected (a folder or file that commit lacks is skipped or explained). Keyed by repository
 * path, like the selection.
 */
import { create } from "zustand";

interface FilesState {
  /** Open folders by path, per repository. */
  expanded: Record<string, Readonly<Record<string, true>> | undefined>;
  /** Path of the row with the cursor (a folder or a file). */
  cursor: Record<string, string | undefined>;
  /** Path of the file the file tab shows. */
  chosen: Record<string, string | undefined>;
  /** What the filter box holds (empty: the whole tree). */
  filter: Record<string, string | undefined>;
  setExpanded: (repoPath: string, path: string, open: boolean) => void;
  /** Opens every folder above `path`, so its row shows in the tree. */
  reveal: (repoPath: string, path: string) => void;
  setFilter: (repoPath: string, filter: string) => void;
  setCursor: (repoPath: string, path: string) => void;
  choose: (repoPath: string, path: string) => void;
}

export const useFilesStore = create<FilesState>()((set) => ({
  expanded: {},
  cursor: {},
  chosen: {},
  filter: {},
  setExpanded: (repoPath, path, open) => {
    set((state) => {
      const current = state.expanded[repoPath] ?? {};
      if (Boolean(current[path]) === open) return state;
      const next = Object.fromEntries(
        Object.entries(current).filter(([folder]) => folder !== path),
      ) as Record<string, true>;
      if (open) next[path] = true;
      return { expanded: { ...state.expanded, [repoPath]: next } };
    });
  },
  reveal: (repoPath, path) => {
    set((state) => {
      const next: Record<string, true> = { ...state.expanded[repoPath] };
      const parts = path.split("/");
      for (let end = 1; end < parts.length; end++) next[parts.slice(0, end).join("/")] = true;
      return { expanded: { ...state.expanded, [repoPath]: next } };
    });
  },
  setFilter: (repoPath, filter) => {
    set((state) => ({ filter: { ...state.filter, [repoPath]: filter } }));
  },
  setCursor: (repoPath, path) => {
    set((state) => ({ cursor: { ...state.cursor, [repoPath]: path } }));
  },
  choose: (repoPath, path) => {
    set((state) => ({
      cursor: { ...state.cursor, [repoPath]: path },
      chosen: { ...state.chosen, [repoPath]: path },
    }));
  },
}));

const NONE: Readonly<Record<string, true>> = {};

/** The open folders of `repoPath`. */
export function useExpanded(repoPath: string): Readonly<Record<string, true>> {
  return useFilesStore((state) => state.expanded[repoPath] ?? NONE);
}

/** What `repoPath`'s filter box holds. */
export function useFilter(repoPath: string): string {
  return useFilesStore((state) => state.filter[repoPath] ?? "");
}

/** The file chosen in `repoPath`'s Files module, if any. */
export function useChosenFile(repoPath: string | undefined): string | undefined {
  return useFilesStore((state) => (repoPath === undefined ? undefined : state.chosen[repoPath]));
}
