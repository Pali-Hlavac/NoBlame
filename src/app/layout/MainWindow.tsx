import { BranchDialogs, useRefActions } from "@/features/branches";
import { OutputWindow, useJobEvents } from "@/features/jobs";
import { CommandPalette } from "@/features/command-palette";
import { CredentialPrompt } from "@/features/credentials";
import { OperationBanner, OperationDialogs } from "@/features/operations";
import { PatchDialogs } from "@/features/patches";
import { RemoteDialogs, openClone } from "@/features/remotes";
import { RefActionsContext } from "@/features/graph";
import {
  CloneRepositoryContext,
  RepositoryBannerContext,
  GroupActionsContext,
  RepositoryActionsContext,
  openRepositories,
  useRepositoryChanges,
  useSessionCleanup,
} from "@/features/repositories";
import { useRepositoryRequests } from "@/features/windows";
import {
  Workbench,
  useModulePopupOpen,
  useSavedLayout,
  type SavedLayout,
} from "@/features/workbench";
import { useTabHotkeys } from "@/features/workspace";
import { LoadingState } from "@/shared/components/LoadingState";

import { useAppCommands } from "../commands/useAppCommands";
import { useHistoryHotkeys } from "../commands/useHistoryHotkeys";
import { DEFAULT_MODULE_LAYOUT, MODULES } from "../workbench/modules";
import { GROUP_ACTIONS, REPOSITORY_ACTIONS } from "../workbench/repositoryActions";
import { MainTitleBar } from "./MainTitleBar";
import { renderTab } from "./renderTab";
import { SettingsButton } from "./SettingsButton";
import { StatusBar } from "./StatusBar";

/** Main window: waits for the saved layout, then shows the workbench. */
/** The bar above a repository's commits: the operation in progress, if any. */
function renderBanner(repoId: number) {
  return <OperationBanner repoId={repoId} />;
}

export function MainWindow() {
  const layout = useSavedLayout();
  if (layout.isPending) return <LoadingState label="Restoring layout…" className="h-screen" />;
  // An unreadable layout is not worth an error screen: start with the default one.
  return <MainWorkbench saved={layout.data ?? null} />;
}

/** Title bar (with the toolbar), workbench, status bar and command palette. */
function MainWorkbench({ saved }: { saved: SavedLayout | null }) {
  const commands = useAppCommands(MODULES);
  // A popped-out module's popup is modal: the window behind waits until it closes.
  const popupOpen = useModulePopupOpen();
  useRepositoryRequests(openRepositories);
  useSessionCleanup();
  useRepositoryChanges();
  useJobEvents();
  useTabHotkeys();
  useHistoryHotkeys();

  return (
    <div className="flex h-screen flex-col bg-background text-foreground" inert={popupOpen}>
      <MainTitleBar />
      <RepositoryActionsContext.Provider value={REPOSITORY_ACTIONS}>
        <GroupActionsContext.Provider value={GROUP_ACTIONS}>
          <CloneRepositoryContext.Provider value={openClone}>
            <RepositoryBannerContext.Provider value={renderBanner}>
              <RefActionsContext.Provider value={useRefActions}>
                <Workbench
                  modules={MODULES}
                  defaultModuleLayout={DEFAULT_MODULE_LAYOUT}
                  renderTab={renderTab}
                  saved={saved}
                  activityBarFooter={<SettingsButton />}
                />
              </RefActionsContext.Provider>
            </RepositoryBannerContext.Provider>
          </CloneRepositoryContext.Provider>
        </GroupActionsContext.Provider>
      </RepositoryActionsContext.Provider>
      <StatusBar />
      <CommandPalette commands={commands} />
      <BranchDialogs />
      <RemoteDialogs />
      <OperationDialogs />
      <PatchDialogs />
      <CredentialPrompt />
      <OutputWindow />
    </div>
  );
}
