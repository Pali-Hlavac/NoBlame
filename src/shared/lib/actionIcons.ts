/**
 * Icons of menu actions, one per action, so an action looks the same in every menu that offers
 * it (the commit graph's menu, the Branches module's). Each is coloured by the kind of work it
 * does (`workKinds.ts`); actions that throw something away are red. Keys are the menus' entry
 * ids; entries without one have no icon.
 */
import {
  ArrowUpFromLineIcon,
  BadgeCheckIcon,
  BugIcon,
  CherryIcon,
  CopyIcon,
  FileArchiveIcon,
  FileOutputIcon,
  FolderTreeIcon,
  GitBranchIcon,
  GitBranchPlusIcon,
  GitCompareArrowsIcon,
  GitMergeIcon,
  GitPullRequestArrowIcon,
  GlobeIcon,
  HighlighterIcon,
  LinkIcon,
  ListOrderedIcon,
  LogInIcon,
  PencilIcon,
  RotateCcwIcon,
  SkipForwardIcon,
  SquareTerminalIcon,
  TagIcon,
  Trash2Icon,
  Undo2Icon,
  UnlinkIcon,
  type LucideIcon,
} from "lucide-react";

import { kindIconClass, type WorkKind } from "./workKinds";

/** What an icon's colour says: a kind of work, or that something is thrown away. */
export type IconTone = WorkKind | "danger";

export interface ActionIcon {
  icon: LucideIcon;
  /** No tone: the text colour. */
  tone?: IconTone;
}

const COMPARE: ActionIcon = { icon: GitCompareArrowsIcon, tone: "history" };
const CHECKOUT: ActionIcon = { icon: LogInIcon, tone: "branches" };
const DELETE: ActionIcon = { icon: Trash2Icon, tone: "danger" };

/** Icons by menu entry id (the ids `commitMenu`, `refEntries` and `branchMenu` give). */
const ACTION_ICONS: Readonly<Record<string, ActionIcon>> = {
  copy: { icon: CopyIcon },
  "copy-name": { icon: CopyIcon },
  highlight: { icon: HighlighterIcon, tone: "history" },
  "compare-head": COMPARE,
  "compare-worktree": COMPARE,
  compare: COMPARE,
  browse: { icon: FolderTreeIcon, tone: "history" },
  checkout: CHECKOUT,
  "create-branch": { icon: GitBranchPlusIcon, tone: "branches" },
  "create-tag": { icon: TagIcon, tone: "branches" },
  merge: { icon: GitMergeIcon, tone: "branches" },
  rebase: { icon: GitPullRequestArrowIcon, tone: "branches" },
  "rebase-interactive": { icon: ListOrderedIcon, tone: "branches" },
  "cherry-pick": { icon: CherryIcon, tone: "commit" },
  revert: { icon: Undo2Icon, tone: "commit" },
  reset: { icon: RotateCcwIcon, tone: "branches" },
  rename: { icon: PencilIcon },
  delete: DELETE,
  "delete-remote": DELETE,
  push: { icon: ArrowUpFromLineIcon, tone: "branches" },
  "set-upstream": { icon: LinkIcon, tone: "branches" },
  "unset-upstream": { icon: UnlinkIcon, tone: "branches" },
  "bisect-bad": { icon: BugIcon, tone: "history" },
  "bisect-good": { icon: BadgeCheckIcon, tone: "history" },
  "bisect-skip": { icon: SkipForwardIcon, tone: "history" },
  patch: { icon: FileOutputIcon, tone: "commit" },
  archive: { icon: FileArchiveIcon, tone: "repositories" },
  scripts: { icon: SquareTerminalIcon },
};

/** The submenus of the references on a commit (`ref:<kind>:<name>`), by kind. */
const REF_ICONS: Readonly<Record<string, ActionIcon>> = {
  branch: { icon: GitBranchIcon, tone: "branches" },
  remote: { icon: GlobeIcon, tone: "branches" },
  tag: { icon: TagIcon, tone: "branches" },
};

/** The icon of the menu entry `id`, if it has one. */
export function actionIcon(id: string): ActionIcon | undefined {
  if (id.startsWith("ref:")) return REF_ICONS[id.split(":")[1] ?? ""];
  return ACTION_ICONS[id];
}

/** The class that colours an icon of `tone`. */
export function toneClass(tone: IconTone | undefined): string | undefined {
  return tone === "danger" ? "text-destructive" : kindIconClass(tone);
}
