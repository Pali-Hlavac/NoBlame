/**
 * Branch and tag actions the graph's menu offers. The branches feature implements them; the app
 * provides them (`RefActionsContext`), so the graph does not depend on that feature.
 */
import { createContext } from "react";

import type { BisectMarkDto, RefTargetDto } from "@/shared/ipc/bindings";

/** A commit or reference a new branch or tag starts at, with how to name it to the user. */
export interface StartPoint {
  /** Passed to git: a commit id, or a branch, remote branch or tag name. */
  revision: string;
  /** Shown: “a1b2c3d4 Fix the parser” or “origin/main”. */
  label: string;
}

/** A commit to cherry-pick or revert; a merge commit asks which parent its changes are against. */
export interface PickSource extends StartPoint {
  parentCount: number;
}

/** How the reset dialog starts. */
export interface ResetOptions {
  /**
   * Restoring an earlier state (the reflog): start on "keep", so the files follow the branch
   * and uncommitted changes are kept (git refuses when they are in the way).
   */
  restore?: boolean;
}

/** What can be done with branches and tags of one repository. */
export interface RefActions {
  /** Checks out a local branch at once. */
  checkoutBranch: (name: string) => void;
  /** Explains a detached HEAD, then checks out the commit. */
  checkoutCommit: (commit: StartPoint) => void;
  /** Checks out a remote branch as a new local branch that tracks it. */
  checkoutRemote: (remote: RefTargetDto) => void;
  createBranch: (start: StartPoint) => void;
  createTag: (start: StartPoint) => void;
  renameBranch: (branch: RefTargetDto) => void;
  /** Asks first, naming the commits only it holds. */
  deleteRef: (reference: RefTargetDto) => void;
  /** Opens the push dialog for a local branch. */
  pushBranch: (branch: string) => void;
  /** Asks which remote, then pushes the tag. */
  pushTag: (tag: string) => void;
  /** Asks first, then deletes a remote branch or a tag on a remote. */
  deleteOnRemote: (reference: RefTargetDto) => void;
  /** Asks how, then merges a branch, tag or commit into the current branch. */
  merge: (source: StartPoint) => void;
  /** Asks how, then applies the commit's changes to the current branch. */
  cherryPick: (commit: PickSource) => void;
  /** Asks how, then undoes the commit's changes in a new commit on the current branch. */
  revert: (commit: PickSource) => void;
  /** Asks how, naming the commits that get new ids, then rebases the current branch onto it. */
  rebase: (onto: StartPoint) => void;
  /** Opens the interactive rebase editor for the commits from `from` up to HEAD. */
  interactiveRebase: (from: StartPoint) => void;
  /** Asks how (soft, mixed, keep, hard), naming what is lost, then moves the current branch. */
  reset: (commit: StartPoint, options?: ResetOptions) => void;
  /**
   * Marks the commit good, bad or skipped in a bisect; without one running, explains bisecting
   * and starts it.
   */
  bisect: (commit: StartPoint, mark: BisectMarkDto) => void;
}

/** A hook giving the actions for a repository; the default offers none (stubs stay labelled). */
export type UseRefActions = (repoId: number) => RefActions | undefined;

export const RefActionsContext = createContext<UseRefActions>(() => undefined);
