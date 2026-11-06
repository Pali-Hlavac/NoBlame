import * as DialogPrimitive from "@radix-ui/react-dialog";
import { CopyIcon, SquareTerminalIcon, XIcon } from "lucide-react";
import { useEffect, useId, useState } from "react";

import { useAppSettings, useChangeSettings } from "@/features/settings";
import type { JobDto } from "@/shared/ipc/bindings";
import { copyToClipboard } from "@/shared/lib/clipboard";
import { Button } from "@/shared/ui/button";

import { useCancelJob, useJobOutput, useJobs } from "../api/jobs";
import { repositoryName } from "../lib/format";
import { closeOutput, selectOutput, useOutputWindow } from "../store/output";
import { OutputConsole } from "./OutputConsole";

/** How long a window whose jobs all succeeded stays up before closing by itself. */
const AUTO_CLOSE_MS = 1500;

const STATE_WORDS: Record<JobDto["state"], string> = {
  running: "running",
  succeeded: "done",
  failed: "failed",
  cancelled: "cancelled",
};

/**
 * The Git output window: a console beside the work (not modal, so the app stays usable)
 * streaming the output of the jobs started while it is open. Opened for new jobs when
 * Settings → "Show git's output in a window" is on, or from a job in the jobs list. Closing it
 * leaves the jobs running in the background.
 */
export function OutputWindow() {
  const { open, jobIds, selected } = useOutputWindow();
  const all = useJobs().data;
  const shown = jobIds.flatMap((id) => all?.find((job) => job.id === id) ?? []);
  const job = shown.find((each) => each.id === selected) ?? shown[0];
  useAutoClose(open, shown, jobIds.length);
  return (
    <DialogPrimitive.Root
      open={open && job !== undefined}
      modal={false}
      onOpenChange={(next) => {
        if (!next) closeOutput();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content
          aria-describedby={undefined}
          // Stays where the user works; clicks elsewhere do not close it.
          onOpenAutoFocus={(event) => {
            event.preventDefault();
          }}
          onInteractOutside={(event) => {
            event.preventDefault();
          }}
          className="fixed top-14 right-4 z-40 flex h-[min(26rem,60vh)] w-[min(44rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg outline-none"
        >
          {job && <OutputBody job={job} shown={shown} />}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function OutputBody({ job, shown }: { job: JobDto; shown: readonly JobDto[] }) {
  const output = useJobOutput(job, true);
  const cancel = useCancelJob();
  const selectId = useId();
  const lines = output.data?.lines;
  return (
    <>
      <div className="flex items-center gap-2 border-b border-border px-3 py-1.5">
        <SquareTerminalIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <DialogPrimitive.Title className="shrink-0 text-sm font-semibold">
          Git output
        </DialogPrimitive.Title>
        {shown.length > 1 ? (
          <>
            <label htmlFor={selectId} className="sr-only">
              Job
            </label>
            <select
              id={selectId}
              className="border-input h-7 min-w-0 flex-1 truncate rounded-md border bg-background px-2 text-xs focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              value={job.id}
              onChange={(event) => {
                selectOutput(Number(event.target.value));
              }}
            >
              {shown.map((each) => (
                <option key={each.id} value={each.id}>
                  {repositoryName(each.repoPath)}: {each.title} ({STATE_WORDS[each.state]})
                </option>
              ))}
            </select>
          </>
        ) : (
          <span
            className="min-w-0 flex-1 truncate text-xs text-muted-foreground"
            title={job.repoPath}
          >
            {repositoryName(job.repoPath)}: {job.title}
          </span>
        )}
        <DialogPrimitive.Close asChild>
          <Button variant="ghost" size="icon" className="size-7" aria-label="Close Git output">
            <XIcon aria-hidden />
          </Button>
        </DialogPrimitive.Close>
      </div>
      <OutputConsole job={job} lines={lines} />
      <div className="flex items-center gap-2 border-t border-border px-3 py-1.5">
        <CloseOnSuccess />
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-xs"
          onClick={() => {
            copyToClipboard([`$ ${job.command}`, ...(lines ?? [])].join("\n"), "Output");
          }}
        >
          <CopyIcon className="size-3.5" aria-hidden />
          Copy output
        </Button>
        {job.state === "running" && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            disabled={cancel.isPending}
            onClick={() => {
              cancel.mutate(job.id);
            }}
          >
            Cancel
          </Button>
        )}
      </div>
    </>
  );
}

/** The window's own switch for the "close when they succeed" setting. */
function CloseOnSuccess() {
  const { closeOutputOnSuccess } = useAppSettings().jobs;
  const change = useChangeSettings();
  return (
    <label className="mr-auto flex items-center gap-1.5 text-xs text-muted-foreground">
      <input
        type="checkbox"
        className="size-3.5 accent-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        checked={closeOutputOnSuccess}
        onChange={(event) => {
          const checked = event.target.checked;
          change((current) => ({
            ...current,
            jobs: { ...current.jobs, closeOutputOnSuccess: checked },
          }));
        }}
      />
      Close when they succeed
    </label>
  );
}

/**
 * Closes the window shortly after every job in it succeeded, when the setting says so; only
 * if one of them ran while it was open (a finished job opened from the jobs list stays).
 */
function useAutoClose(open: boolean, shown: readonly JobDto[], expected: number): void {
  const { closeOutputOnSuccess } = useAppSettings().jobs;
  const [ranHere, setRanHere] = useState(false);
  const running = shown.some((job) => job.state === "running");
  // Adjusted while rendering (not in an effect), as React recommends for derived state.
  if (!open && ranHere) setRanHere(false);
  if (open && running && !ranHere) setRanHere(true);
  const allSucceeded = shown.length === expected && shown.every((job) => job.state === "succeeded");
  useEffect(() => {
    if (!open || !ranHere || !closeOutputOnSuccess || !allSucceeded) return;
    const timer = setTimeout(closeOutput, AUTO_CLOSE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [allSucceeded, closeOutputOnSuccess, open, ranHere]);
}
