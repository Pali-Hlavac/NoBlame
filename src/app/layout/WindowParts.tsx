/**
 * What the main window and task windows share: the contexts the repository views read their
 * actions from, and the dialogs those actions open.
 */
import type { ReactNode } from "react";

import { BranchDialogs, useRefActions } from "@/features/branches";
import { CredentialPrompt } from "@/features/credentials";
import { RefActionsContext } from "@/features/graph";
import { OutputWindow } from "@/features/jobs";
import { OperationBanner, OperationDialogs } from "@/features/operations";
import { PatchDialogs } from "@/features/patches";
import { RemoteDialogs, openClone } from "@/features/remotes";
import {
  CloneRepositoryContext,
  GroupActionsContext,
  RepositoryActionsContext,
  RepositoryBannerContext,
  SubmoduleUpdateDialog,
} from "@/features/repositories";

import { GROUP_ACTIONS, REPOSITORY_ACTIONS } from "../workbench/repositoryActions";

/** The bar above a repository's commits: the operation in progress, if any. */
function renderBanner(repoId: number) {
  return <OperationBanner repoId={repoId} />;
}

/** The actions repository views, menus and the graph offer. */
export function RepositoryContexts({ children }: { children: ReactNode }) {
  return (
    <RepositoryActionsContext.Provider value={REPOSITORY_ACTIONS}>
      <GroupActionsContext.Provider value={GROUP_ACTIONS}>
        <CloneRepositoryContext.Provider value={openClone}>
          <RepositoryBannerContext.Provider value={renderBanner}>
            <RefActionsContext.Provider value={useRefActions}>
              {children}
            </RefActionsContext.Provider>
          </RepositoryBannerContext.Provider>
        </CloneRepositoryContext.Provider>
      </GroupActionsContext.Provider>
    </RepositoryActionsContext.Provider>
  );
}

/**
 * The dialogs those actions open (the submodule update's question included: the bar and the
 * file menus ask it too), the credential prompt and the Git output window.
 */
export function WindowDialogs() {
  return (
    <>
      <BranchDialogs />
      <RemoteDialogs />
      <OperationDialogs />
      <PatchDialogs />
      <SubmoduleUpdateDialog />
      <CredentialPrompt />
      <OutputWindow />
    </>
  );
}
