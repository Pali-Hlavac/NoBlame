import { useEffect, useRef } from "react";

import { isDialogOpen } from "@/shared/lib/dialogs";
import { matchesHotkey } from "@/shared/lib/hotkeys";
import { keysOf } from "@/shared/lib/keybindings";
import { isMacPlatform } from "@/shared/lib/platform";

import { openModule } from "../lib/docks";
import { focusRegion } from "../lib/regions";
import type { WorkbenchModule } from "../types";

/**
 * F6 / Shift+F6 cycle focus between regions; each module's shortcut opens it. The keys are read
 * on each key press, so shortcuts changed in Settings apply at once.
 */
export function useWorkbenchHotkeys(modules: readonly WorkbenchModule[]): void {
  const modulesRef = useRef(modules);
  useEffect(() => {
    modulesRef.current = modules;
  }, [modules]);

  useEffect(() => {
    const isMac = isMacPlatform();
    const onKeyDown = (event: KeyboardEvent): void => {
      if (isDialogOpen()) return;
      if (matchesHotkey(event, keysOf("regions.next"), isMac)) {
        event.preventDefault();
        focusRegion(1);
        return;
      }
      if (matchesHotkey(event, keysOf("regions.previous"), isMac)) {
        event.preventDefault();
        focusRegion(-1);
        return;
      }
      const module = modulesRef.current.find(
        (candidate) =>
          candidate.keybinding !== undefined &&
          matchesHotkey(event, keysOf(candidate.keybinding), isMac),
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
