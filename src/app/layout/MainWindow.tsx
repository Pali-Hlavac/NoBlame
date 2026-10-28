import { CommandPalette } from "@/features/command-palette";
import { openRepositories, useSessionCleanup } from "@/features/repositories";
import { useRepositoryRequests } from "@/features/windows";
import { Workbench, useSavedLayout, type SavedLayout } from "@/features/workbench";
import { useTabHotkeys } from "@/features/workspace";
import { LoadingState } from "@/shared/components/LoadingState";

import { useAppCommands } from "../commands/useAppCommands";
import { DEFAULT_MODULE_LAYOUT, MODULES } from "../workbench/modules";
import { MainTitleBar } from "./MainTitleBar";
import { renderTab } from "./renderTab";
import { StatusBar } from "./StatusBar";

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
  useRepositoryRequests(openRepositories);
  useSessionCleanup();
  useTabHotkeys();

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <MainTitleBar />
      <Workbench
        modules={MODULES}
        defaultModuleLayout={DEFAULT_MODULE_LAYOUT}
        renderTab={renderTab}
        saved={saved}
      />
      <StatusBar />
      <CommandPalette commands={commands} />
    </div>
  );
}
