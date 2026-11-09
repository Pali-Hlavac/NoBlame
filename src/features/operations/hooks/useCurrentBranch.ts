import { useActiveRepository } from "@/features/repositories";

/**
 * The name of what an operation changes in repository `repoId`: its current branch, "HEAD"
 * when it is detached, or "the current branch" when the repository is not the active one.
 */
export function useCurrentBranch(repoId: number): string {
  const { summary } = useActiveRepository();
  const head = summary?.id === repoId ? summary.head : undefined;
  if (!head) return "the current branch";
  return head.kind === "detached" ? "HEAD" : head.name;
}
