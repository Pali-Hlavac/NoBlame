import { SettingsIcon } from "lucide-react";

import { ActivityBarButton } from "@/features/workbench";
import { SETTINGS_TAB, useTabsStore } from "@/features/workspace";
import { useHotkey } from "@/shared/hooks/useHotkey";
import { isDialogOpen } from "@/shared/lib/dialogs";
import { formatHotkey } from "@/shared/lib/hotkeys";
import { isMacPlatform } from "@/shared/lib/platform";

import { SETTINGS_HOTKEY, openSettings } from "./settingsTab";

/** The gear at the bottom of the activity bar; also binds the Settings shortcut. */
export function SettingsButton() {
  const showing = useTabsStore((state) => state.activeTabId === SETTINGS_TAB.id);
  useHotkey(SETTINGS_HOTKEY, () => {
    if (!isDialogOpen()) openSettings();
  });
  return (
    <ActivityBarButton
      label={`Settings (${formatHotkey(SETTINGS_HOTKEY, isMacPlatform())})`}
      icon={SettingsIcon}
      pressed={showing}
      onClick={openSettings}
    />
  );
}
