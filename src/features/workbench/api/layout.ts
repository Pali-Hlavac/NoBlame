/** Loading and saving the workbench layout (one layout for all repositories). */
import { useQuery } from "@tanstack/react-query";

import { commands, unwrap } from "@/shared/ipc/client";

import { parseSavedLayout, type SavedLayout } from "../lib/layout";

export const layoutKeys = { saved: ["workbench-layout"] as const };

/** The layout saved by the previous session, or `null` (first start, reset, unreadable). */
export function useSavedLayout() {
  return useQuery({
    queryKey: layoutKeys.saved,
    queryFn: async () => parseSavedLayout(await unwrap(commands.getWorkbenchLayout())),
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

/** Saves `layout`; `null` forgets the saved layout. */
export async function saveLayout(layout: SavedLayout | null): Promise<void> {
  await unwrap(commands.saveWorkbenchLayout(layout));
}
