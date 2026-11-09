/**
 * The history-changing dialog asked for, if any. The graph's menu and the Branches module ask
 * (through the branch actions); `OperationDialogs`, mounted once in the main window, shows it.
 */
import { create } from "zustand";

import type { StartPoint } from "@/features/graph";

export interface OperationDialogRequest {
  kind: "merge";
  repoId: number;
  /** What to merge into the current branch. */
  source: StartPoint;
}

interface OperationDialogState {
  request: OperationDialogRequest | null;
}

export const useOperationDialogStore = create<OperationDialogState>(() => ({ request: null }));

/** Asks to merge `source` into the current branch of repository `repoId`. */
export function openMerge(repoId: number, source: StartPoint): void {
  useOperationDialogStore.setState({ request: { kind: "merge", repoId, source } });
}

export function closeOperationDialog(): void {
  useOperationDialogStore.setState({ request: null });
}
