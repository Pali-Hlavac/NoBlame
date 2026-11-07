/**
 * The remotes or clone dialog asked for, if any. The toolbar, the palette, the Branches module
 * and the Welcome tab ask; `RemoteDialogs` (mounted once in the main window) shows it.
 */
import { create } from "zustand";

export type RemoteDialogRequest =
  /** The remotes of an open repository; `adding` opens the form to add one. */
  { kind: "remotes"; repoId: number; adding?: boolean } | { kind: "clone" };

export const useRemoteDialogStore = create<{ request: RemoteDialogRequest | null }>(() => ({
  request: null,
}));

/** Shows the Remotes dialog of the repository `repoId`. */
export function openRemotes(repoId: number, adding = false): void {
  useRemoteDialogStore.setState({ request: { kind: "remotes", repoId, adding } });
}

/** Shows the Clone dialog. */
export function openClone(): void {
  useRemoteDialogStore.setState({ request: { kind: "clone" } });
}

export function closeRemoteDialog(): void {
  useRemoteDialogStore.setState({ request: null });
}
