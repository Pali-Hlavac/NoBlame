/**
 * Branch and tag actions the graph's menu offers. The branches feature implements them; the app
 * provides them (`RefActionsContext`), so the graph does not depend on that feature.
 */
import { createContext } from "react";

import type { RefTargetDto } from "@/shared/ipc/bindings";

/** A commit or reference a new branch or tag starts at, with how to name it to the user. */
export interface StartPoint {
  /** Passed to git: a commit id, or a branch, remote branch or tag name. */
  revision: string;
  /** Shown: “a1b2c3d4 Fix the parser” or “origin/main”. */
  label: string;
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
}

/** A hook giving the actions for a repository; the default offers none (stubs stay labelled). */
export type UseRefActions = (repoId: number) => RefActions | undefined;

export const RefActionsContext = createContext<UseRefActions>(() => undefined);
