/** How the graph names a reference to commands that take a revision (the compare tab). */
import type { RefLabel } from "@/shared/ipc/bindings";

/** The full name of a reference, so a branch and a tag with the same name stay apart. */
export function refRevision(ref: Pick<RefLabel, "kind" | "name">): string {
  switch (ref.kind) {
    case "branch":
      return `refs/heads/${ref.name}`;
    case "remote":
      return `refs/remotes/${ref.name}`;
    case "tag":
      return `refs/tags/${ref.name}`;
    case "head":
      return "HEAD";
  }
}
