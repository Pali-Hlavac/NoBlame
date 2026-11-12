/**
 * What each task window shows (M8): the workbench modules it offers and the tabs it opens on
 * the path it was given. Tasks without an entry still show the placeholder.
 */
import { showOnlyPath } from "@/features/graph";
import { repositoryTab } from "@/features/repositories";
import type { WorkspaceTab } from "@/features/workspace";
import type { PathScopeDto, RepoSummary, TaskKind } from "@/shared/ipc/bindings";

/** The repository a task window was opened in, and where in it. */
export interface TaskTarget {
  /** The path given, as given (`noblame log <path>`). */
  path: string;
  summary: RepoSummary;
  /** Where `path` lies in the working tree; `null` outside it (a bare repository). */
  scope: PathScopeDto | null;
}

export interface TaskSpec {
  /** Ids of the modules the activity bar offers (see `workbench/modules.ts`). */
  modules: readonly string[];
  /** Module dock arrangement: groups top to bottom, tabs inside. */
  moduleLayout: readonly (readonly string[])[];
  /** Readies the session before the tabs first render (log: only the path's history). */
  prepare?: (target: TaskTarget) => Promise<void>;
  /** The tabs the window opens with; the first is active. */
  tabs: (target: TaskTarget) => WorkspaceTab[];
}

/** The repository tab of a task window, titled with the repository's name. */
function graphTab({ path, summary }: TaskTarget): WorkspaceTab {
  return { ...repositoryTab(path), title: summary.name };
}

export const TASK_SPECS: Partial<Record<TaskKind, TaskSpec>> = {
  log: {
    modules: ["branches", "commit-details", "changed-files", "files"],
    moduleLayout: [["branches"], ["commit-details", "changed-files", "files"]],
    prepare: async ({ summary, scope }) => {
      if (scope?.relative) await showOnlyPath(summary.id, scope.relative);
    },
    tabs: (target) => [graphTab(target)],
  },
};
