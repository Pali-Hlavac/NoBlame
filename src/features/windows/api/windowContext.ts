/** What this window is for (main window or a task window) and opening task windows. */
import { useMutation, useQuery } from "@tanstack/react-query";

import type { TaskKind } from "@/shared/ipc/bindings";
import { commands, unwrap } from "@/shared/ipc/client";

export const windowContextQueryKey = ["window-context"] as const;

/** A window's purpose never changes, so it is fetched once. */
export function useWindowContext() {
  return useQuery({
    queryKey: windowContextQueryKey,
    queryFn: () => unwrap(commands.getWindowContext()),
    staleTime: Infinity,
  });
}

/** Shows `path` in the main window (opening it if needed), like `noblame <path>`. */
export async function openInMainWindow(path: string): Promise<void> {
  await unwrap(commands.openInMainWindow(path));
}

/** Opens a task window, like `noblame <task> <path>` on the command line. */
export function useOpenTaskWindow() {
  return useMutation({
    mutationFn: ({ task, path }: { task: TaskKind; path: string }) =>
      unwrap(commands.openTaskWindow(task, path)),
  });
}
