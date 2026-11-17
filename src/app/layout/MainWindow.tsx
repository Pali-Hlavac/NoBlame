import { CommandPalette } from "@/features/command-palette";
import { useJobEvents } from "@/features/jobs";
import { UpdateDialog, useStartupUpdateCheck } from "@/features/updates";
import { openRepositories, useRepositoryChanges, useSessionCleanup } from "@/features/repositories";
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
import { useCommandHotkeys } from "../commands/useCommandHotkeys";
import { useHistoryHotkeys } from "../commands/useHistoryHotkeys";
import { DEFAULT_MODULE_LAYOUT, MODULES } from "../workbench/modules";
import { MainTitleBar } from "./MainTitleBar";
import { renderTab } from "./renderTab";
import { SettingsButton } from "./SettingsButton";
import { StatusBar } from "./StatusBar";
import { RepositoryContexts, WindowDialogs } from "./WindowParts";

/** Main window: waits for the saved layout, then shows the workbench. */
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
  useCommandHotkeys(commands);
  useStartupUpdateCheck();

  return (
    <div className="flex h-screen flex-col bg-background text-foreground" inert={popupOpen}>
      <MainTitleBar />
      <RepositoryContexts>
        <Workbench
          modules={MODULES}
          defaultModuleLayout={DEFAULT_MODULE_LAYOUT}
          renderTab={renderTab}
          saved={saved}
          activityBarFooter={<SettingsButton />}
        />
      </RepositoryContexts>
      <StatusBar />
      <CommandPalette commands={commands} />
      <WindowDialogs />
      <UpdateDialog />
    </div>
  );
}
