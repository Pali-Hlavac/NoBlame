/** Opening a working tree file in its default app, or showing it in the file manager. */
import { toast } from "sonner";

import { commands, toIpcError, unwrap } from "@/shared/ipc/client";

function failed(what: string) {
  return (error: unknown) => {
    const { message, hint } = toIpcError(error);
    toast.error(what, {
      description: hint ? `${message}\n${hint}` : message,
      classNames: { description: "whitespace-pre-line" },
    });
  };
}

/**
 * Opens the working tree file at `path` in its default app. Files that would run as programs
 * are refused, and a toast says why.
 */
export function openWorktreeFile(repoId: number, path: string): void {
  unwrap(commands.openWorktreeFile(repoId, path)).catch(failed("Could not open the file"));
}

/** Shows the working tree file at `path` in the file manager (its folder, when it is gone). */
export function showWorktreeFile(repoId: number, path: string): void {
  unwrap(commands.showWorktreeFile(repoId, path)).catch(failed("Could not show the file"));
}
