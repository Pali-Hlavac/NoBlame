/** How HEAD is described in the UI. */
import type { RepoSummary } from "@/shared/ipc/bindings";

/** Characters of a detached HEAD's commit id that are shown. */
const DETACHED_ID_LENGTH = 8;

/** `main`, `main (no commits yet)` or `detached at 1a2b3c4d`. */
export function headLabel(head: RepoSummary["head"]): string {
  switch (head.kind) {
    case "branch":
      return head.name;
    case "unborn":
      return `${head.name} (no commits yet)`;
    case "detached":
      return `detached at ${head.id.slice(0, DETACHED_ID_LENGTH)}`;
  }
}
