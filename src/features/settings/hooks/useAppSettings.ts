import { useSettings, useUpdateSettings } from "../api/settings";
import { withDefaults, type AppSettings } from "../lib/defaults";

/** The settings, with defaults for anything not loaded or not saved yet. */
export function useAppSettings(): AppSettings {
  return withDefaults(useSettings().data);
}

/** Saves a change to the settings (ignored until they are loaded, so nothing is overwritten). */
export function useChangeSettings(): (change: (current: AppSettings) => AppSettings) => void {
  const { data } = useSettings();
  const { mutate } = useUpdateSettings();
  return (change) => {
    if (data) mutate(change(withDefaults(data)));
  };
}
