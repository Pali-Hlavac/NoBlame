/**
 * The module registry: every module the activity bar offers, in order. A new module is a
 * component in its feature folder plus one entry here (ids are saved in layouts; never reuse).
 */
import { FolderGitIcon, GitCommitHorizontalIcon } from "lucide-react";

import { CommitDetailsModule } from "@/features/commit-details";
import { RepositoryList } from "@/features/repositories";
import type { WorkbenchModule } from "@/features/workbench";

export const MODULES: readonly WorkbenchModule[] = [
  {
    id: "repositories",
    title: "Repositories",
    icon: FolderGitIcon,
    hotkey: "alt+1",
    component: RepositoryList,
  },
  {
    id: "commit-details",
    title: "Commit details",
    icon: GitCommitHorizontalIcon,
    hotkey: "alt+2",
    component: CommitDetailsModule,
  },
];

/** Module dock on first start and after "Reset layout": groups top to bottom, tabs inside. */
export const DEFAULT_MODULE_LAYOUT: readonly (readonly string[])[] = [
  ["repositories"],
  ["commit-details"],
];
