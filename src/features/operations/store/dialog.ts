/**
 * The history-changing dialog asked for, if any. The graph's menu and the Branches module ask
 * (through the branch actions); `OperationDialogs`, mounted once in the main window, shows it.
 */
import { create } from "zustand";

import type { PickSource, StartPoint } from "@/features/graph";

export type OperationDialogRequest =
  | {
      kind: "merge";
      repoId: number;
      /** What to merge into the current branch. */
      source: StartPoint;
    }
  | {
      kind: "cherryPick" | "revert";
      repoId: number;
      commit: PickSource;
    }
  | {
      kind: "rebase";
      repoId: number;
      /** What the current branch's own commits are replayed on. */
      onto: StartPoint;
    }
  | {
      kind: "interactive";
      repoId: number;
      /** The oldest commit to edit; it and the commits after it up to HEAD are listed. */
      from: StartPoint;
    }
  | {
      kind: "conflicts";
      repoId: number;
    }
  | {
      kind: "reset";
      repoId: number;
      /** Where the current branch moves to. */
      commit: StartPoint;
      /** Restoring an earlier state: the dialog starts on "keep". */
      restore: boolean;
    };

interface OperationDialogState {
  request: OperationDialogRequest | null;
}

export const useOperationDialogStore = create<OperationDialogState>(() => ({ request: null }));

function open(request: OperationDialogRequest): void {
  useOperationDialogStore.setState({ request });
}

/** Asks to merge `source` into the current branch of repository `repoId`. */
export function openMerge(repoId: number, source: StartPoint): void {
  open({ kind: "merge", repoId, source });
}

/** Asks to cherry-pick or revert `commit` on the current branch of repository `repoId`. */
export function openPick(repoId: number, kind: "cherryPick" | "revert", commit: PickSource): void {
  open({ kind, repoId, commit });
}

/** Asks how to rebase the current branch of repository `repoId` onto `onto`. */
export function openRebase(repoId: number, onto: StartPoint): void {
  open({ kind: "rebase", repoId, onto });
}

/** Opens the interactive rebase editor for the commits from `from` up to HEAD. */
export function openInteractive(repoId: number, from: StartPoint): void {
  open({ kind: "interactive", repoId, from });
}

/** Asks how to reset the current branch of repository `repoId` to `commit`. */
export function openReset(repoId: number, commit: StartPoint, restore = false): void {
  open({ kind: "reset", repoId, commit, restore });
}

/** Shows the conflicted files of repository `repoId`, to resolve them. */
export function openConflicts(repoId: number): void {
  open({ kind: "conflicts", repoId });
}

export function closeOperationDialog(): void {
  useOperationDialogStore.setState({ request: null });
}
