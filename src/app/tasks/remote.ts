/**
 * Fetch, Pull and Push windows (M8 slice 4): the graph and Branches, and the task's dialog,
 * open when the window starts and again from its bar. The job runs in the background; the Git
 * output window shows its progress.
 */
import { openBranchDialog } from "@/features/branches";
import { IpcError } from "@/shared/ipc/client";
import type { TaskKind } from "@/shared/ipc/bindings";

import { graphTab } from "./graphTab";
import { openRemoteTask } from "./remoteTask";
import type { TaskSpec, TaskTarget } from "./specs";

const MODULES = ["branches"] as const;

/** The current branch, which pull and push work on. */
export function currentBranch({ summary }: TaskTarget): string | undefined {
  return summary.head.kind === "detached" ? undefined : summary.head.name;
}

/** Pull and push need HEAD on a branch: the window says so instead of a dialog. */
function needBranch(target: TaskTarget): Promise<void> {
  if (currentBranch(target) !== undefined) return Promise.resolve();
  return Promise.reject(
    new IpcError(
      "INVALID_INPUT",
      "HEAD is not on a branch, so there is nothing to pull into or push.",
      "Switch to a branch first (Open in NoBlame, then Branches).",
    ),
  );
}

function remoteSpec(start: TaskSpec["start"], startLabel: string, branch = false): TaskSpec {
  return {
    modules: MODULES,
    moduleLayout: [MODULES],
    prepare: branch ? needBranch : undefined,
    tabs: (target) => [graphTab(target)],
    start,
    startLabel,
  };
}

export const REMOTE_SPECS: Partial<Record<TaskKind, TaskSpec>> = {
  fetch: remoteSpec(() => {
    openRemoteTask("fetch");
  }, "Fetch…"),
  pull: remoteSpec(
    () => {
      openRemoteTask("pull");
    },
    "Pull…",
    true,
  ),
  push: remoteSpec(
    (target) => {
      const branch = currentBranch(target);
      if (branch !== undefined) {
        openBranchDialog({ kind: "push-branch", repoId: target.summary.id, branch });
      }
    },
    "Push…",
    true,
  ),
};
