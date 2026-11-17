/** Which branch task's question is open in a Switch, Merge or Rebase window. */
import { create } from "zustand";

export type RefPickTask = "switch" | "merge" | "rebase";

export const useRefPickStore = create<{ open: RefPickTask | null }>()(() => ({ open: null }));

/** Asks which branch to switch to, merge or rebase onto (when the window starts, and from its bar). */
export function openRefPick(task: RefPickTask): void {
  useRefPickStore.setState({ open: task });
}

/** Closes it. */
export function closeRefPick(): void {
  useRefPickStore.setState({ open: null });
}
