/**
 * Fetching from the toolbar, the command palette and the Repositories module's "…" menu
 * (M5 slice 3). The job reports its progress and result itself (status bar, toast).
 */
import { RefreshCwIcon, ScissorsIcon } from "lucide-react";
import { useCallback } from "react";
import { toast } from "sonner";

import type { PaletteCommand } from "@/features/command-palette";
import { startFetch } from "@/features/jobs";
import { useActiveRepository } from "@/features/repositories";
import type { FetchTargetDto } from "@/shared/ipc/bindings";
import { toIpcError } from "@/shared/ipc/client";

/** Starts a fetch of the active repository. */
export type StartFetch = (target: FetchTargetDto, prune: boolean) => void;

/** The fetches the toolbar and the palette offer. */
export const FETCHES = [
  { id: "fetch", label: "Fetch", target: { type: "default" }, prune: false, icon: RefreshCwIcon },
  {
    id: "fetch-all",
    label: "Fetch all remotes",
    target: { type: "all" },
    prune: false,
    icon: RefreshCwIcon,
  },
  {
    id: "fetch-prune",
    label: "Fetch and prune",
    target: { type: "default" },
    prune: true,
    icon: ScissorsIcon,
  },
] as const satisfies readonly {
  id: string;
  label: string;
  target: FetchTargetDto;
  prune: boolean;
  icon: typeof RefreshCwIcon;
}[];

/** Fetches `path`; a toast says so when the fetch cannot even start (not a repository, ...). */
export function fetchRepository(path: string, target: FetchTargetDto, prune: boolean): void {
  startFetch({ path, target, prune }).catch((error: unknown) => {
    const { message, hint } = toIpcError(error);
    toast.error("Could not start the fetch", {
      description: hint ? `${message}\n${hint}` : message,
      classNames: { description: "whitespace-pre-line" },
    });
  });
}

/** Fetches the active repository; `undefined` while none is open. */
export function useStartFetch(): StartFetch | undefined {
  const path = useActiveRepository().tab?.path;
  const start = useCallback<StartFetch>(
    (target, prune) => {
      if (path !== undefined) fetchRepository(path, target, prune);
    },
    [path],
  );
  return path === undefined ? undefined : start;
}

/** The palette's fetch commands, while a repository is active. */
export function useFetchCommands(): PaletteCommand[] {
  const start = useStartFetch();
  if (!start) return [];
  return FETCHES.map((fetch) => ({
    id: `remote.${fetch.id}`,
    group: "Remote",
    label: fetch.label,
    icon: fetch.icon,
    kind: "branches",
    keywords: ["download", "remote", "update", ...(fetch.prune ? ["prune", "delete"] : [])],
    run: () => {
      start(fetch.target, fetch.prune);
    },
  }));
}
