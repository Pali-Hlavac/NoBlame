import { useQuery } from "@tanstack/react-query";

import { fetchPathScope, useRepositorySession } from "@/features/repositories";
import { setStatusScope } from "@/features/working-tree";
import { useTabsStore } from "@/features/workspace";

import type { TaskSpec, TaskTarget } from "./specs";

/**
 * Opens the repository a task window was given a path in, finds where in it the path lies,
 * readies the session for the task and opens the task's tabs, once.
 */
export function useTaskTarget(path: string, spec: TaskSpec) {
  const session = useRepositorySession(path);
  const summary = session.data;
  const target = useQuery({
    queryKey: ["task-target", path],
    enabled: summary !== undefined,
    queryFn: async (): Promise<TaskTarget> => {
      if (!summary) throw new Error("the repository is not open yet");
      const target = { path, summary, scope: await fetchPathScope(summary.id, path) };
      // Everything in the window shows the status of that folder or file only.
      setStatusScope(target.scope?.relative ?? null);
      await spec.prepare?.(target);
      const tabs = spec.tabs(target);
      useTabsStore.getState().replaceTabs(tabs, tabs[0]?.id ?? null);
      return target;
    },
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });
  return { session, target };
}
