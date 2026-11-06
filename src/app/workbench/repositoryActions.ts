/**
 * Actions in the "…" menu and quick buttons of the repositories in the Repositories module (open,
 * grouped and recent), and on its groups. Pull, Fetch and Push work on closed repositories too:
 * their jobs only need the folder.
 */
import {
  ArrowDownToLineIcon,
  ArrowUpFromLineIcon,
  CopyIcon,
  FolderOpenIcon,
  GitCommitVerticalIcon,
  RefreshCwIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";

import { startBatch, startJob, startPull, startPushCurrent } from "@/features/jobs";
import { openRepositories, type GroupAction, type RepositoryAction } from "@/features/repositories";
import { useTabsStore } from "@/features/workspace";
import { openCommit } from "./commit";
import { fetchRepository } from "./remote";

/** Pulling, fetching and pushing are about branches and remotes. */
const BRANCHES = "branches";

/** The actions; Commit… opens (or shows) the repository, then the Commit module. */
export const REPOSITORY_ACTIONS: readonly RepositoryAction[] = [
  {
    id: "pull",
    label: "Pull",
    icon: ArrowDownToLineIcon,
    kind: BRANCHES,
    button: "pull",
    job: "pull",
    // As the toolbar's Pull: the way the repository's config says.
    run: ({ path }) => {
      startJob(startPull({ path, mode: "default" }), "pull");
    },
  },
  {
    id: "fetch",
    label: "Fetch",
    icon: RefreshCwIcon,
    kind: BRANCHES,
    // Open or not: the job only needs the folder.
    run: ({ path }) => {
      fetchRepository(path, { type: "default" }, false);
    },
  },
  {
    id: "push",
    label: "Push",
    icon: ArrowUpFromLineIcon,
    kind: BRANCHES,
    button: "push",
    job: "push",
    // The current branch to its upstream; without one the toast says to use Push… instead.
    run: ({ path }) => {
      startJob(startPushCurrent(path), "push");
    },
  },
  {
    id: "commit",
    label: "Commit…",
    icon: GitCommitVerticalIcon,
    kind: "commit",
    run: ({ path, tabId, open }) => {
      if (open) useTabsStore.getState().activateTab(tabId);
      else openRepositories([path]);
      openCommit();
    },
  },
  {
    id: "copy-path",
    label: "Copy path",
    icon: CopyIcon,
    group: "start",
    run: ({ path }) => {
      navigator.clipboard.writeText(path).then(
        () => toast.success("Path copied"),
        () => toast.error("Could not copy the path"),
      );
    },
  },
  {
    id: "open",
    label: "Open",
    icon: FolderOpenIcon,
    kind: "repositories",
    when: "closed",
    run: ({ path }) => {
      openRepositories([path]);
    },
  },
  {
    id: "close",
    label: "Close",
    icon: XIcon,
    when: "open",
    run: ({ tabId }) => {
      useTabsStore.getState().closeTab(tabId);
    },
  },
];

/** Every repository of a group, one job each, summed up in one toast when all have ended. */
export const GROUP_ACTIONS: readonly GroupAction[] = [
  {
    id: "pull-all",
    label: "Pull all",
    icon: ArrowDownToLineIcon,
    kind: BRANCHES,
    button: "pullAll",
    job: "pull",
    // Merging, as asked for: a rebase stopped by conflicts in one of many repositories is
    // harder to notice and finish than a merge.
    run: ({ name, paths }) => {
      startBatch(
        `Pull all in ${name}`,
        paths.map((path) => ({ path, start: () => startPull({ path, mode: "merge" }) })),
      );
    },
  },
  {
    id: "push-all",
    label: "Push all",
    icon: ArrowUpFromLineIcon,
    kind: BRANCHES,
    button: "pushAll",
    job: "push",
    run: ({ name, paths }) => {
      startBatch(
        `Push all in ${name}`,
        paths.map((path) => ({ path, start: () => startPushCurrent(path) })),
      );
    },
  },
];
