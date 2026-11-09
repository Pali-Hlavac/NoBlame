/**
 * Starting a job from a menu, button or dialog: a toast says so at once and then follows the job
 * (`toasts.tsx`); errors before git runs become that toast's message.
 */
import { toast } from "sonner";

import type { JobKindDto } from "@/shared/ipc/bindings";
import { toIpcError } from "@/shared/ipc/client";

import { bindJobToast, startingToast } from "./toasts";

/**
 * Shows "Fetching…" (by `kind`) at once and hands the toast to the job when `started` gives its
 * id. Returns `started`, for callers that need the id. When the job could not even start, the
 * toast goes; `startJob` then says why, a dialog may show it itself.
 */
export function trackJob(started: Promise<number>, kind: JobKindDto): Promise<number> {
  const toastId = startingToast(kind);
  started.then(
    (id) => {
      bindJobToast(id, toastId);
    },
    () => {
      toast.dismiss(toastId);
    },
  );
  return started;
}

/**
 * Like `trackJob`; if the job could not even start (not a repository, an invalid name), says so
 * as "Could not start the <kind>". The job reports the rest itself.
 */
export function startJob(started: Promise<number>, kind: JobKindDto): void {
  trackJob(started, kind).catch((error: unknown) => {
    const { message, hint } = toIpcError(error);
    toast.error(`Could not start the ${kind}`, {
      description: hint ? `${message}\n${hint}` : message,
      classNames: { description: "whitespace-pre-line" },
    });
  });
}
