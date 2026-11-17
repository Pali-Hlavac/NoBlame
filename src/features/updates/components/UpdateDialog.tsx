import { useEffect, useState } from "react";

import { InlineError } from "@/shared/components/InlineError";
import { events, type UpdateProgress } from "@/shared/ipc/bindings";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";

import { useInstallUpdate } from "../api/updates";
import { closeUpdateDialog, useUpdatesStore } from "../store/updates";

const MEGABYTE = 1024 * 1024;

function megabytes(bytes: number): string {
  return `${(bytes / MEGABYTE).toFixed(1)} MB`;
}

/** How far the download got, as the backend reports it (`UpdateProgress`). */
function useProgress(active: boolean): UpdateProgress | null {
  const [progress, setProgress] = useState<UpdateProgress | null>(null);
  useEffect(() => {
    if (!active) return;
    const unlisten = events.updateProgress.listen(({ payload }) => {
      setProgress(payload);
    });
    return () => {
      void unlisten.then((stop) => {
        stop();
      });
    };
  }, [active]);
  return active ? progress : null;
}

/** A newer release: its notes, then Install and restart with the download's progress. */
export function UpdateDialog() {
  const { available, dialogOpen } = useUpdatesStore();
  const install = useInstallUpdate();
  const progress = useProgress(install.isPending);
  if (!available) return null;
  // f64 fields arrive as `number | null`.
  const downloaded = progress?.downloaded ?? 0;
  const total = progress?.total ?? null;
  return (
    <Dialog
      open={dialogOpen}
      onOpenChange={(open) => {
        // Installing cannot be stopped half way.
        if (!open && !install.isPending) closeUpdateDialog();
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>NoBlame {available.version} is available</DialogTitle>
          <DialogDescription>
            You have {available.currentVersion}. Installing downloads the new version, closes
            NoBlame (running fetches and pushes stop) and starts it again.
          </DialogDescription>
        </DialogHeader>
        {available.notes && (
          <div
            role="region"
            aria-label="What is new"
            // A scrolling region must take focus so the keyboard can scroll it (WCAG 2.1.1).
            // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
            tabIndex={0}
            className="max-h-64 overflow-auto rounded-md border border-border bg-muted/30 p-3 text-sm whitespace-pre-wrap focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {available.notes}
          </div>
        )}
        {install.isPending && (
          <div className="space-y-1 text-sm">
            <progress
              className="w-full accent-primary"
              aria-label="Downloading the update"
              value={downloaded}
              max={total ?? undefined}
            />
            <p className="text-xs text-muted-foreground">
              {progress
                ? `${megabytes(downloaded)}${total ? ` of ${megabytes(total)}` : ""}`
                : "Starting the download…"}
            </p>
          </div>
        )}
        {install.error && <InlineError error={install.error} />}
        <div className="flex justify-end gap-2">
          <Button variant="outline" disabled={install.isPending} onClick={closeUpdateDialog}>
            Later
          </Button>
          <Button
            disabled={install.isPending}
            onClick={() => {
              install.mutate();
            }}
          >
            {install.isPending ? "Installing…" : "Install and restart"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
