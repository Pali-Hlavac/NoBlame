/** Which of a Pull or Fetch window's dialogs is open. */
import { create } from "zustand";

export type RemoteTask = "pull" | "fetch";

export const useRemoteTaskStore = create<{ open: RemoteTask | null }>()(() => ({ open: null }));

/** Opens the Pull or Fetch window's dialog (when the window starts, and from its bar). */
export function openRemoteTask(task: RemoteTask): void {
  useRemoteTaskStore.setState({ open: task });
}

/** Closes it. */
export function closeRemoteTask(): void {
  useRemoteTaskStore.setState({ open: null });
}
