/** Where a path lies inside an open repository (the folder or file a task window shows). */
import { commands, unwrap } from "@/shared/ipc/client";
import type { PathScopeDto } from "@/shared/ipc/bindings";

/** `path` relative to the top of session `repoId`'s working tree; `null` outside it. */
export function fetchPathScope(repoId: number, path: string): Promise<PathScopeDto | null> {
  return unwrap(commands.getPathScope(repoId, path));
}
