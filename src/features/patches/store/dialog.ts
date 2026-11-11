/**
 * The patch or archive dialog asked for, if any. The commit menu, the palette and the toolbar
 * ask; `PatchDialogs`, mounted once in the main window, shows it.
 */
import { create } from "zustand";

import type { PickSource, StartPoint } from "@/features/graph";

export type PatchDialogRequest =
  | {
      kind: "create";
      repoId: number;
      /** The newest commit; a merge starts on "the commits after…". */
      commit: PickSource;
    }
  | { kind: "apply"; repoId: number }
  | {
      kind: "archive";
      repoId: number;
      /** The repository's folder (the job opens it by path). */
      path: string;
      commit: StartPoint;
      /** A name for the files: a tag on the commit, or its short id. */
      name: string;
    };

interface PatchDialogState {
  request: PatchDialogRequest | null;
}

export const usePatchDialogStore = create<PatchDialogState>(() => ({ request: null }));

/** Asks which commits ending at `commit` get patches, and where. */
export function openCreatePatches(repoId: number, commit: PickSource): void {
  usePatchDialogStore.setState({ request: { kind: "create", repoId, commit } });
}

/** Opens the dialog choosing patch files to apply in repository `repoId`. */
export function openApplyPatches(repoId: number): void {
  usePatchDialogStore.setState({ request: { kind: "apply", repoId } });
}

/** Asks how to archive the files of `commit` (format, folder inside), then where. */
export function openArchive(repoId: number, path: string, commit: StartPoint, name: string): void {
  usePatchDialogStore.setState({ request: { kind: "archive", repoId, path, commit, name } });
}

export function closePatchDialog(): void {
  usePatchDialogStore.setState({ request: null });
}
