import { SETTINGS_TAB, useTabsStore } from "@/features/workspace";
import { keysOf } from "@/shared/lib/keybindings";

/** Opens the Settings tab (as in most editors). */
export const SETTINGS_HOTKEY = keysOf("settings.open");

/** Opens the Settings tab, or focuses it when it is open. */
export function openSettings(): void {
  useTabsStore.getState().openTab(SETTINGS_TAB);
}
