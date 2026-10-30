/**
 * The module registry: every module the activity bar offers, in order. A new module is a
 * component in its feature folder plus one entry here (ids are saved in layouts; never reuse).
 */
import {
  ArchiveIcon,
  FileDiffIcon,
  FolderGitIcon,
  FolderTreeIcon,
  GitBranchIcon,
  GitCommitHorizontalIcon,
} from "lucide-react";

import { BranchesModule } from "@/features/branches";
import { ChangedFilesModule } from "@/features/changed-files";
import { CommitDetailsModule } from "@/features/commit-details";
import { FilesModule } from "@/features/files";
import { RepositoriesModule } from "@/features/repositories";
import { StashesModule } from "@/features/stashes";
import type { WorkbenchModule } from "@/features/workbench";

export const MODULES: readonly WorkbenchModule[] = [
  {
    id: "repositories",
    title: "Repositories",
    icon: FolderGitIcon,
    hotkey: "alt+1",
    component: RepositoriesModule,
  },
  {
    id: "branches",
    title: "Branches",
    icon: GitBranchIcon,
    hotkey: "alt+2",
    component: BranchesModule,
  },
  {
    id: "commit-details",
    title: "Commit details",
    icon: GitCommitHorizontalIcon,
    hotkey: "alt+3",
    component: CommitDetailsModule,
  },
  {
    id: "stashes",
    title: "Stashes",
    icon: ArchiveIcon,
    hotkey: "alt+4",
    component: StashesModule,
  },
  {
    id: "changed-files",
    title: "Changed files",
    icon: FileDiffIcon,
    hotkey: "alt+5",
    component: ChangedFilesModule,
  },
  {
    // The commit context menu opens it by this id ("Browse files at this commit").
    id: "files",
    title: "Files",
    icon: FolderTreeIcon,
    hotkey: "alt+6",
    component: FilesModule,
  },
];

/** Module dock on first start and after "Reset layout": groups top to bottom, tabs inside. */
export const DEFAULT_MODULE_LAYOUT: readonly (readonly string[])[] = [
  ["repositories", "branches"],
  ["commit-details", "changed-files", "files", "stashes"],
];
