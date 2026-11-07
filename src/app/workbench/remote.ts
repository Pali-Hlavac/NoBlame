/**
 * Fetch, pull and push of the active repository, for the toolbar and the command palette, and
 * fetching any repository for the Repositories module's "…" menu. Each runs as a background job
 * that reports its own progress and result (status bar, toast).
 */
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownToLineIcon,
  ArrowUpFromLineIcon,
  CloudIcon,
  RefreshCwIcon,
  ScissorsIcon,
  type LucideIcon,
} from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";

import { openBranchDialog, pushCurrentBranch } from "@/features/branches";
import { startFetch, startJob, startPull } from "@/features/jobs";
import { openRemotes } from "@/features/remotes";
import { useActiveRepository } from "@/features/repositories";
import type { FetchTargetDto, PullModeDto } from "@/shared/ipc/bindings";
import { toIpcError } from "@/shared/ipc/client";

interface RemoteCommand<T> {
  id: string;
  label: string;
  icon: LucideIcon;
  value: T;
  keywords: string[];
}

/** The pulls offered: as configured, then each way explicitly. */
export const PULLS: readonly RemoteCommand<PullModeDto>[] = [
  { id: "pull", label: "Pull", icon: ArrowDownToLineIcon, value: "default", keywords: [] },
  {
    id: "pull-merge",
    label: "Pull (merge)",
    icon: ArrowDownToLineIcon,
    value: "merge",
    keywords: ["merge"],
  },
  {
    id: "pull-rebase",
    label: "Pull (rebase)",
    icon: ArrowDownToLineIcon,
    value: "rebase",
    keywords: ["rebase"],
  },
  {
    id: "pull-ff",
    label: "Pull (fast-forward only)",
    icon: ArrowDownToLineIcon,
    value: "fastForwardOnly",
    keywords: ["fast-forward", "ff"],
  },
];

interface FetchChoice {
  target: FetchTargetDto;
  prune: boolean;
}

/** The fetches offered. */
export const FETCHES: readonly RemoteCommand<FetchChoice>[] = [
  {
    id: "fetch",
    label: "Fetch",
    icon: RefreshCwIcon,
    value: { target: { type: "default" }, prune: false },
    keywords: [],
  },
  {
    id: "fetch-all",
    label: "Fetch all remotes",
    icon: RefreshCwIcon,
    value: { target: { type: "all" }, prune: false },
    keywords: ["all"],
  },
  {
    id: "fetch-prune",
    label: "Fetch and prune",
    icon: ScissorsIcon,
    value: { target: { type: "default" }, prune: true },
    keywords: ["prune", "delete"],
  },
];

export const PUSH_ICON = ArrowUpFromLineIcon;
export const REMOTES_ICON = CloudIcon;

/** Fetches the repository at `path` (open or not). */
export function fetchRepository(path: string, target: FetchTargetDto, prune: boolean): void {
  startJob(startFetch({ path, target, prune }), "fetch");
}

/** What can be done with the active repository's remotes. */
export interface RemoteActions {
  fetch: (choice: FetchChoice) => void;
  pull: (mode: PullModeDto) => void;
  /** Pushes the current branch to its upstream, or asks where (the Push dialog). */
  push: () => void;
  /** Opens the Push dialog for the current branch. */
  pushWithOptions: () => void;
  /** Opens the Remotes dialog (add, edit, remove remotes). */
  manageRemotes: () => void;
  /** The current branch, when HEAD is on one (pull and push need it). */
  branch: string | undefined;
}

/** The active repository's remote actions; `undefined` while none is open. */
export function useRemoteActions(): RemoteActions | undefined {
  const queryClient = useQueryClient();
  const { tab, summary } = useActiveRepository();
  const path = tab?.path;
  const repoId = summary?.id;
  const branch = summary && summary.head.kind !== "detached" ? summary.head.name : undefined;
  return useMemo(() => {
    if (path === undefined || repoId === undefined) return undefined;
    return {
      branch,
      fetch: ({ target, prune }) => {
        fetchRepository(path, target, prune);
      },
      pull: (mode) => {
        startJob(startPull({ path, mode }), "pull");
      },
      push: () => {
        if (branch === undefined) return;
        pushCurrentBranch(queryClient, repoId, path, branch).catch((error: unknown) => {
          toast.error("Could not start the push", { description: toIpcError(error).message });
        });
      },
      pushWithOptions: () => {
        if (branch !== undefined) openBranchDialog({ kind: "push-branch", repoId, branch });
      },
      manageRemotes: () => {
        openRemotes(repoId);
      },
    };
  }, [branch, path, queryClient, repoId]);
}
