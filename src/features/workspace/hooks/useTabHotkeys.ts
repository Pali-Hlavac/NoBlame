import { useHotkey } from "@/shared/hooks/useHotkey";
import { useKeys } from "@/shared/hooks/useKeys";
import { isDialogOpen } from "@/shared/lib/dialogs";

import { useTabsStore } from "../store/tabs";

/** Registers global tab shortcuts (close, next, previous); ignored while a dialog is open. */
export function useTabHotkeys(): void {
  const { closeTab, cycleTab } = useTabsStore.getState();

  useHotkey(useKeys("tabs.close"), () => {
    const { activeTabId } = useTabsStore.getState();
    if (activeTabId && !isDialogOpen()) closeTab(activeTabId);
  });
  useHotkey(useKeys("tabs.next"), () => {
    if (!isDialogOpen()) cycleTab(1);
  });
  useHotkey(useKeys("tabs.previous"), () => {
    if (!isDialogOpen()) cycleTab(-1);
  });
}
