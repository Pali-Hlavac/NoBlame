/** What the commit dialog's title says about where the commit goes. */
import type { HeadDto } from "@/shared/ipc/bindings";

/** "Commit to main", or "Commit (detached HEAD)". */
export function commitTitle(head: HeadDto): string {
  return head.kind === "detached" ? "Commit (detached HEAD)" : `Commit to ${head.name}`;
}
