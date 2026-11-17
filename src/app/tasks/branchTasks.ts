/**
 * Switch, Merge, Rebase and Stash windows (M8 slice 5): the graph beside Branches (Stashes for
 * stash), and the task's question, asked when the window starts and again from its bar. The
 * choice goes to the dialogs the graph's menus open, so they work as in the main window.
 */
import { openStashChanges } from "@/features/stashes";
import type { TaskKind } from "@/shared/ipc/bindings";

import { graphTab } from "./graphTab";
import { openRefPick, type RefPickTask } from "./refPick";
import type { TaskSpec } from "./specs";

const BRANCHES = ["branches"] as const;
const STASHES = ["stashes"] as const;

function pickSpec(task: RefPickTask, startLabel: string): TaskSpec {
  return {
    modules: BRANCHES,
    moduleLayout: [BRANCHES],
    tabs: (target) => [graphTab(target)],
    start: () => {
      openRefPick(task);
    },
    startLabel,
  };
}

export const BRANCH_SPECS: Partial<Record<TaskKind, TaskSpec>> = {
  switch: pickSpec("switch", "Switch…"),
  merge: pickSpec("merge", "Merge…"),
  rebase: pickSpec("rebase", "Rebase…"),
  stash: {
    modules: STASHES,
    moduleLayout: [STASHES],
    tabs: (target) => [graphTab(target)],
    start: ({ summary }) => {
      openStashChanges(summary.id);
    },
    startLabel: "Stash changes…",
  },
};
