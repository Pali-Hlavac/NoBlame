import { SettingsIcon } from "lucide-react";

import { ActivityBarButton } from "@/features/workbench";
import { SETTINGS_TAB, useTabsStore } from "@/features/workspace";
import { useHotkey } from "@/shared/hooks/useHotkey";
import { useKeys } from "@/shared/hooks/useKeys";
import { isDialogOpen } from "@/shared/lib/dialogs";
import { withHotkey } from "@/shared/lib/hotkeys";
import { isMacPlatform } from "@/shared/lib/platform";

import { openSettings } from "./settingsTab";

/** The gear at the bottom of the activity bar; also binds the Settings shortcut. */
export function SettingsButton() {
  const showing = useTabsStore((state) => state.activeTabId === SETTINGS_TAB.id);
  const keys = useKeys("settings.open");
  useHotkey(keys, () => {
    if (!isDialogOpen()) openSettings();
  });
  return (
    <ActivityBarButton
      label={withHotkey("Settings", keys, isMacPlatform())}
      icon={SettingsIcon}
      pressed={showing}
      onClick={openSettings}
    />
  );
}
