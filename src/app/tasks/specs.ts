/**
 * What each task window shows (M8): the workbench modules it offers and the tabs it opens on
 * the path it was given. Tasks without an entry still show the placeholder.
 */
import { showOnlyPath } from "@/features/graph";
import { repositoryTab } from "@/features/repositories";
import { BLAME_TAB, DIFF_TAB, HISTORY_TAB, type WorkspaceTab } from "@/features/workspace";
import type { PathScopeDto, RepoSummary, TaskKind } from "@/shared/ipc/bindings";

import { chooseScopedFile } from "./choose";
import { blameScopedFile, showScopedHistory } from "./inspect";

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
  /** The sidebar's width, when the default does not fit the module. */
  sidebarWidthPx?: number;
  /** Readies the session before the tabs first render. */
  prepare?: (target: TaskTarget) => Promise<void>;
  /** The tabs the window opens with; the first is active. */
  tabs: (target: TaskTarget) => WorkspaceTab[];
}

/** The repository tab of a task window, titled with the repository's name. */
function graphTab({ path, summary }: TaskTarget): WorkspaceTab {
  return { ...repositoryTab(path), title: summary.name };
}

/** The graph shows only the history of the folder or file the window was opened on. */
async function limitGraph({ summary, scope }: TaskTarget): Promise<void> {
  if (scope?.relative) await showOnlyPath(summary.id, scope.relative);
}

/** Commit and Diff windows: the graph limited, and a file given is chosen for the diff tab. */
async function prepareChanges(target: TaskTarget): Promise<void> {
  await limitGraph(target);
  await chooseScopedFile(target);
}

/** The commit's lists need room; so do the changed files' paths. */
const COMMIT_SIDEBAR_PX = 440;
const CHANGES_SIDEBAR_PX = 360;

/** Beside a blame or a history: the chosen commit. */
const INSPECT_MODULES = ["commit-details", "changed-files"] as const;

export const TASK_SPECS: Partial<Record<TaskKind, TaskSpec>> = {
  log: {
    modules: ["branches", "commit-details", "changed-files", "files"],
    moduleLayout: [["branches"], ["commit-details", "changed-files", "files"]],
    prepare: limitGraph,
    tabs: (target) => [graphTab(target)],
  },
  commit: {
    modules: ["commit"],
    moduleLayout: [["commit"]],
    sidebarWidthPx: COMMIT_SIDEBAR_PX,
    prepare: prepareChanges,
    tabs: (target) => [DIFF_TAB, graphTab(target)],
  },
  diff: {
    modules: ["changed-files"],
    moduleLayout: [["changed-files"]],
    sidebarWidthPx: CHANGES_SIDEBAR_PX,
    prepare: prepareChanges,
    tabs: (target) => [DIFF_TAB, graphTab(target)],
  },
  // A line's or a row's commit is selected: its details and files are beside it.
  blame: {
    modules: INSPECT_MODULES,
    moduleLayout: [INSPECT_MODULES],
    prepare: async (target) => {
      await limitGraph(target);
      await blameScopedFile(target);
    },
    tabs: (target) => [BLAME_TAB, graphTab(target)],
  },
  fileHistory: {
    modules: INSPECT_MODULES,
    moduleLayout: [INSPECT_MODULES],
    prepare: async (target) => {
      await limitGraph(target);
      showScopedHistory(target);
    },
    // The top of the repository has no file history: its graph is the whole history.
    tabs: (target) =>
      target.scope?.relative ? [HISTORY_TAB, graphTab(target)] : [graphTab(target)],
  },
};
