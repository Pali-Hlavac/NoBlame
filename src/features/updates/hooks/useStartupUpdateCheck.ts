import { useEffect } from "react";
import { toast } from "sonner";

import { useAppSettings } from "@/features/settings";

import { checkForUpdate, useUpdateSupport } from "../api/updates";
import { showUpdate, useUpdatesStore } from "../store/updates";

/** Waits this long after the start, so the first screen is not slowed down. */
const START_DELAY_MS = 10_000;

/**
 * Looks for a new release once after the main window starts, when the build updates itself and
 * Settings → Updates allows it; a found one is offered in a toast. A failed check stays quiet
 * (offline, say): About → Check for updates says why.
 */
export function useStartupUpdateCheck(): void {
  const configured = useUpdateSupport().data?.configured === true;
  const enabled = useAppSettings().updates.checkOnStart;
  useEffect(() => {
    if (!configured || !enabled) return;
    const timer = setTimeout(() => {
      checkForUpdate()
        .then((update) => {
          if (!update) return;
          useUpdatesStore.setState({ available: update });
          toast(`NoBlame ${update.version} is available`, {
            description: `You have ${update.currentVersion}.`,
            duration: Infinity,
            action: {
              label: "See what's new",
              onClick: () => {
                showUpdate(update);
              },
            },
          });
        })
        .catch((error: unknown) => {
          console.warn("Checking for updates failed", error);
        });
    }, START_DELAY_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [configured, enabled]);
}
