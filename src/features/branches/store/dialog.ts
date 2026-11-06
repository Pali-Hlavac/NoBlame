/**
 * The branch or tag dialog asked for, if any. The graph's menu, the Branches module and the
 * toolbar ask; `BranchDialogs` (mounted once in the main window) shows it.
 */
import { create } from "zustand";

import type { StartPoint } from "@/features/graph";
import type { RefTargetDto } from "@/shared/ipc/bindings";

export type { StartPoint };

/** Which repository a dialog acts on. */
interface Target {
  repoId: number;
}

export type BranchDialogRequest = Target &
  (
    | { kind: "create-branch"; start: StartPoint }
    /** Check out a remote branch as a new local branch that tracks it. */
    | { kind: "checkout-remote"; remote: RefTargetDto }
    | { kind: "create-tag"; start: StartPoint }
    | { kind: "rename-branch"; branch: RefTargetDto }
    | { kind: "delete"; reference: RefTargetDto }
    | { kind: "checkout-commit"; commit: StartPoint }
  );

interface BranchDialogState {
  request: BranchDialogRequest | null;
}

export const useBranchDialogStore = create<BranchDialogState>(() => ({ request: null }));

/** Shows a branch or tag dialog (replacing one already shown). */
export function openBranchDialog(request: BranchDialogRequest): void {
  useBranchDialogStore.setState({ request });
}

export function closeBranchDialog(): void {
  useBranchDialogStore.setState({ request: null });
}
