import { useEffect } from "react";

import { setUserKeybindings } from "@/shared/lib/keybindings";

import { useAppSettings } from "../hooks/useAppSettings";

/**
 * Applies the shortcuts changed in Settings to the shortcut registry (`keybindings.ts`), which
 * every key handler reads; the settings stay their only record. Mounted once, like the theme.
 */
export function KeybindingsController() {
  const { keybindings } = useAppSettings();
  useEffect(() => {
    setUserKeybindings(keybindings);
  }, [keybindings]);
  return null;
}
