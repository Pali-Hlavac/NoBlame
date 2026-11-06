/** Starting a job from a menu or button: errors before git runs become a toast. */
import { toast } from "sonner";

import { toIpcError } from "@/shared/ipc/client";

/**
 * Waits for `started` (a job's id); if the job could not even start (not a repository, an
 * invalid name), says so as "Could not start the <what>". The job reports the rest itself.
 */
export function startJob(started: Promise<number>, what: string): void {
  started.catch((error: unknown) => {
    const { message, hint } = toIpcError(error);
    toast.error(`Could not start the ${what}`, {
      description: hint ? `${message}\n${hint}` : message,
      classNames: { description: "whitespace-pre-line" },
    });
  });
}
