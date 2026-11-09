/** Saving a file of a revision to a place the user picks. */
import { toast } from "sonner";

import { commands, toIpcError, unwrap } from "@/shared/ipc/client";

/**
 * Asks where to save blob `blobId` (proposing `fileName`), writes it exactly as the repository
 * stores it and says where it went. Nothing happens when the dialog is cancelled.
 */
export async function saveFileAs(repoId: number, blobId: string, fileName: string) {
  try {
    const path = await unwrap(commands.saveFileAs(repoId, blobId, fileName));
    if (path !== null) toast.success("File saved", { description: path });
  } catch (error: unknown) {
    const { message, hint } = toIpcError(error);
    toast.error(message, { description: hint ?? undefined });
  }
}
