import { useEffect, useRef } from "react";

import { isDialogOpen } from "@/shared/lib/dialogs";
import { matchesHotkey } from "@/shared/lib/hotkeys";
import { isMacPlatform } from "@/shared/lib/platform";

import { openModule } from "../lib/docks";
import { focusRegion } from "../lib/regions";
import type { WorkbenchModule } from "../types";
import { keysOf } from "@/shared/lib/keybindings";

/** Shortcuts that move focus to the next / previous region of the window. */
export const REGION_HOTKEYS = {
  next: keysOf("regions.next"),
  previous: keysOf("regions.previous"),
} as const;

/** F6 / Shift+F6 cycle focus between regions; each module's hotkey opens it. */
export function useWorkbenchHotkeys(modules: readonly WorkbenchModule[]): void {
  const modulesRef = useRef(modules);
  useEffect(() => {
    modulesRef.current = modules;
  }, [modules]);

  useEffect(() => {
    const isMac = isMacPlatform();
    const onKeyDown = (event: KeyboardEvent): void => {
      if (isDialogOpen()) return;
      if (matchesHotkey(event, REGION_HOTKEYS.next, isMac)) {
        event.preventDefault();
        focusRegion(1);
        return;
      }
      if (matchesHotkey(event, REGION_HOTKEYS.previous, isMac)) {
        event.preventDefault();
        focusRegion(-1);
        return;
      }
      const module = modulesRef.current.find(
        (candidate) => candidate.hotkey && matchesHotkey(event, candidate.hotkey, isMac),
      );
      if (module) {
        event.preventDefault();
        openModule(module);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);
}
