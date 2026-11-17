/**
 * The repository whose "Stash changes" dialog is open, if any: the Stashes module's button and
 * the Stash window ask; `StashChangesDialog`, mounted once per window, shows it.
 */
import { create } from "zustand";

export const useStashDialogStore = create<{ repoId: number | null }>()(() => ({ repoId: null }));

/** Opens "Stash changes" for repository `repoId`. */
export function openStashChanges(repoId: number): void {
  useStashDialogStore.setState({ repoId });
}

export function closeStashChanges(): void {
  useStashDialogStore.setState({ repoId: null });
}
