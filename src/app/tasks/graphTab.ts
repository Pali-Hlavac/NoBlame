import { repositoryTab } from "@/features/repositories";
import type { WorkspaceTab } from "@/features/workspace";

import type { TaskTarget } from "./specs";

/** The repository tab of a task window, titled with the repository's name. */
export function graphTab({ path, summary }: TaskTarget): WorkspaceTab {
  return { ...repositoryTab(path), title: summary.name };
}
