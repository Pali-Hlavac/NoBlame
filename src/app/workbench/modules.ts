/**
 * The module registry: every module the activity bar offers, in order. A new module is a
 * component in its feature folder plus one entry here (ids are saved in layouts; never reuse).
 */
import { FolderGitIcon } from "lucide-react";

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
];

/** Module dock on first start and after "Reset layout": groups top to bottom, tabs inside. */
export const DEFAULT_MODULE_LAYOUT: readonly (readonly string[])[] = [["repositories"]];
