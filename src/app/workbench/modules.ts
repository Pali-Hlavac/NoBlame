/**
 * The module registry: every module the activity bar offers, in order. A new module is a
 * component in its feature folder plus one entry here (ids are saved in layouts; never reuse).
 */
import {
  ArchiveIcon,
  FileDiffIcon,
  FolderGitIcon,
  FolderTreeIcon,
  FoldersIcon,
  GitBranchIcon,
  GitCommitHorizontalIcon,
  GitCommitVerticalIcon,
  HardDriveIcon,
  HistoryIcon,
} from "lucide-react";

import { BranchesModule } from "@/features/branches";
import { ChangedFilesModule } from "@/features/changed-files";
import { CommitModule } from "@/features/commit";
import { CommitDetailsModule } from "@/features/commit-details";
import { FilesModule } from "@/features/files";
import { LfsModule } from "@/features/lfs";
import { ReflogModule } from "@/features/reflog";
import { RepositoriesModule } from "@/features/repositories";
import { StashesModule } from "@/features/stashes";
import type { WorkbenchModule } from "@/features/workbench";
import { WorktreesModule } from "@/features/worktrees";

import { COMMIT_MODULE_ID } from "./commit";
import { keysOf } from "@/shared/lib/keybindings";

export const MODULES: readonly WorkbenchModule[] = [
  {
    id: "repositories",
    title: "Repositories",
    icon: FolderGitIcon,
    kind: "repositories",
    hotkey: keysOf("module.repositories"),
    component: RepositoriesModule,
  },
  {
    id: "branches",
    title: "Branches",
    icon: GitBranchIcon,
    kind: "branches",
    hotkey: keysOf("module.branches"),
    component: BranchesModule,
  },
  {
    id: "commit-details",
    title: "Commit details",
    icon: GitCommitHorizontalIcon,
    kind: "commit",
    hotkey: keysOf("module.commit-details"),
    component: CommitDetailsModule,
  },
  {
    id: "stashes",
    title: "Stashes",
    icon: ArchiveIcon,
    kind: "stash",
    hotkey: keysOf("module.stashes"),
    component: StashesModule,
  },
  {
    id: "changed-files",
    title: "Changed files",
    icon: FileDiffIcon,
    kind: "commit",
    hotkey: keysOf("module.changed-files"),
    component: ChangedFilesModule,
  },
  {
    // The commit context menu opens it by this id ("Browse files at this commit").
    id: "files",
    title: "Files",
    icon: FolderTreeIcon,
    kind: "history",
    hotkey: keysOf("module.files"),
    component: FilesModule,
  },
  {
    // The Commit button opens it by this id.
    id: COMMIT_MODULE_ID,
    title: "Commit",
    icon: GitCommitVerticalIcon,
    kind: "commit",
    hotkey: keysOf("module.commit"),
    component: CommitModule,
    // Popped out, it shows the chosen file's diff beside the lists.
    popupWide: true,
  },
  {
    id: "reflog",
    title: "Reflog",
    icon: HistoryIcon,
    kind: "history",
    hotkey: keysOf("module.reflog"),
    component: ReflogModule,
  },
  {
    id: "worktrees",
    title: "Worktrees",
    icon: FoldersIcon,
    kind: "repositories",
    hotkey: keysOf("module.worktrees"),
    component: WorktreesModule,
  },
  {
    id: "lfs",
    title: "Git LFS",
    icon: HardDriveIcon,
    kind: "repositories",
    hotkey: keysOf("module.lfs"),
    component: LfsModule,
  },
];

/** Module dock on first start and after "Reset layout": groups top to bottom, tabs inside. */
export const DEFAULT_MODULE_LAYOUT: readonly (readonly string[])[] = [
  ["repositories", "branches", "worktrees"],
  ["commit-details", "changed-files", "files", "stashes", "reflog"],
];
