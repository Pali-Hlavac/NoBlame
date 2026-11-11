import { SETTINGS_TAB, useTabsStore } from "@/features/workspace";

/** Opens the Settings tab, or focuses it when it is open. */
export function openSettings(): void {
  useTabsStore.getState().openTab(SETTINGS_TAB);
}
