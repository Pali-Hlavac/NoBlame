import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect } from "react";

import { useAppSettings } from "@/features/settings";
import type { TaskKind } from "@/shared/ipc/bindings";
import { onActionDone } from "@/shared/lib/actionDone";

/** Long enough to see the success toast before the window goes. */
export const CLOSE_AFTER_SUCCESS_MS = 1_500;

/**
 * With "Close a task window once its action succeeded" (Settings → Task windows), closes this
 * window a moment after its task's action succeeded: a commit in the Commit window, a pull in
 * the Pull window, a checkout in the Switch window, and so on. Failures, conflicts and other
 * actions leave it open.
 */
export function useCloseWhenDone(task: TaskKind): void {
  const enabled = useAppSettings().taskWindows.closeAfterSuccess;
  useEffect(() => {
    if (!enabled) return undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stop = onActionDone((action) => {
      if (action !== task || timer !== undefined) return;
      timer = setTimeout(() => {
        getCurrentWindow()
          .close()
          .catch(() => {
            // The window stays; the user can close it.
          });
      }, CLOSE_AFTER_SUCCESS_MS);
    });
    return () => {
      stop();
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [enabled, task]);
}
